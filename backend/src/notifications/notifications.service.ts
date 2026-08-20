import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationChannel, Prisma } from '@prisma/client';
import { renderEmail, escapeHtml } from './email-template';

export interface NotifyParams {
  recipientType: 'member' | 'trainer' | 'branch' | 'admin';
  recipientId: string;
  type: string; // 'credentials_delivery' | 'transfer_created' | 'transfer_accepted' | 'transfer_declined'
              // | 'session_cancelled' | 'reassignment_needed' | 'session_reminder' | 'result_ready' | ...
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  /** Set this AND recipientAddress when the notification must also go out over push/SMS/email — e.g.
   * credential delivery, which must reach the member before they've ever logged in (spec §11). Leave
   * both unset for in-app-only dashboard alerts (e.g. reassignment_needed). */
  channel?: NotificationChannel;
  recipientAddress?: string;
}

/**
 * One table serves two jobs: the addressable in-app notification
 * center (recipientType/recipientId/type/title/body/data/readAt) AND
 * the outbound delivery log (channel/status/attempts) for the subset
 * that must also physically reach a phone/inbox. Registration
 * credentials and PIN resets are must-deliver — everything else can
 * degrade to in-app-only if the external channel isn't configured yet.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async notify(params: NotifyParams): Promise<void> {
    const row = await this.prisma.notification.create({
      data: {
        recipientType: params.recipientType,
        recipientId: params.recipientId,
        type: params.type,
        title: params.title,
        body: params.body,
        data: params.data as Prisma.InputJsonValue,
        channel: params.channel,
        recipientAddress: params.recipientAddress,
        status: params.channel ? 'pending' : 'sent',
        sentAt: params.channel ? undefined : new Date(),
      },
    });
    if (params.channel) await this.attemptDelivery(row.id);
  }

  async attemptDelivery(notificationId: string): Promise<void> {
    const row = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!row || row.status === 'sent' || !row.channel || !row.recipientAddress) return;

    try {
      await this.deliver(row.channel, row.recipientAddress, row.title, row.body);
      await this.prisma.notification.update({
        where: { id: row.id },
        data: { status: 'sent', sentAt: new Date(), attempts: { increment: 1 } },
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown delivery error.';
      await this.prisma.notification.update({
        where: { id: row.id },
        data: { status: 'failed', lastError: message, attempts: { increment: 1 } },
      });
    }
  }

  /** Re-attempts anything not yet sent — called by the scheduled retry job. */
  async retryPending(limit = 50): Promise<number> {
    const rows = await this.prisma.notification.findMany({
      where: { status: { in: ['pending', 'failed'] }, attempts: { lt: 5 }, channel: { not: null } },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
    for (const row of rows) await this.attemptDelivery(row.id);
    return rows.length;
  }

  // ── In-app inbox reads ───────────────────────────────────────────────
  listForRecipient(recipientType: string, recipientId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { recipientType, recipientId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(id: string, recipientType: string, recipientId: string) {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    if (!row || row.recipientType !== recipientType || row.recipientId !== recipientId) {
      throw new NotFoundException('Notification not found.');
    }
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  private async deliver(channel: NotificationChannel, recipientAddress: string, title: string | null, body: string): Promise<void> {
    if (channel === 'push') {
      const token = this.config.get<string>('notifications.expoPushAccessToken');
      if (!token) { this.logger.warn(`[stub] would push to ${recipientAddress}: ${body}`); return; }
      // TODO: real Expo Push API call.
      this.logger.log(`Push -> ${recipientAddress}: ${body}`);
      return;
    }
    if (channel === 'sms') {
      const key = this.config.get<string>('notifications.smsProviderApiKey');
      if (!key) { this.logger.warn(`[stub] would SMS ${recipientAddress}: ${body}`); return; }
      // TODO: real SMS provider call (e.g. Twilio/MSG91).
      this.logger.log(`SMS -> ${recipientAddress}: ${body}`);
      return;
    }
    if (channel === 'email') {
      await this.deliverEmail(recipientAddress, title, body);
      return;
    }
  }

  /**
   * Resend (https://resend.com) — production email provider. Every
   * email in this codebase (credential delivery, OTPs, password
   * resets, cancellation/reassignment notices) goes through this one
   * path, wrapped in the shared branded template. With no
   * RESEND_API_KEY configured this degrades to a console-logged stub
   * (same fallback pattern as push/SMS above) so local dev never
   * blocks on having a real API key.
   */
  private async deliverEmail(recipientAddress: string, title: string | null, body: string): Promise<void> {
    const apiKey = this.config.get<string>('notifications.resendApiKey');
    const heading = title || 'A message from UV Active';
    const html = renderEmail({
      logoUrl: this.config.get<string>('branding.logoUrl')!,
      appName: this.config.get<string>('branding.appName')!,
      heading,
      bodyHtml: `<p style="margin:0;white-space:pre-line;">${escapeHtml(body)}</p>`,
    });

    if (!apiKey) {
      this.logger.warn(`[stub — RESEND_API_KEY not set] would email ${recipientAddress} (${heading}): ${body}`);
      return;
    }

    const from = this.config.get<string>('notifications.emailFrom')!;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [recipientAddress], subject: heading, html }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Resend delivery failed (${res.status}): ${errBody.slice(0, 300)}`);
    }
  }

  // Rolling 30-day window, not calendar-month — re-evaluated on every
  // request rather than reset at month boundaries, per spec ("email
  // sending in 1 month refresh model").
  async getEmailStats() {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [sent30d, totalSent] = await Promise.all([
      this.prisma.notification.count({ where: { channel: 'email', status: 'sent', sentAt: { gte: since } } }),
      this.prisma.notification.count({ where: { channel: 'email', status: 'sent' } }),
    ]);
    return { emailsSent30d: sent30d, emailsSentTotal: totalSent };
  }
}
