import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SensorsService } from '../sensors/sensors.service';
import { AppException } from '../common/exceptions/app.exception';
import { CreateSessionDto, EndSessionDto } from './sessions.dto';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
    private readonly sensors: SensorsService,
  ) {}

  async create(gymId: string, creatorId: string, dto: CreateSessionDto) {
    let trainerId = creatorId;
    if (dto.trainerId && dto.trainerId !== creatorId) {
      const assignee = await this.prisma.trainer.findUnique({ where: { id: dto.trainerId } });
      if (!assignee || assignee.gymId !== gymId) {
        throw new NotFoundException('That trainer was not found at this branch.');
      }
      if (assignee.status !== 'active') {
        throw new BadRequestException('Cannot assign a session to a suspended trainer.');
      }
      trainerId = dto.trainerId;
    }

    // Capacity is fully automatic — always the number of physical sensor
    // straps ("sensor slots") registered at this gym, full stop. There is
    // no trainer/branch-set capacity anymore (dto.capacity is ignored
    // outright, whatever a client sends). A gym with zero sensors
    // registered yet falls back to a default rather than blocking session
    // creation outright, since that would strand any branch that hasn't
    // populated its Sensor tab yet.
    const sensorCount = await this.sensors.countForGym(gymId);
    const capacity = sensorCount > 0 ? sensorCount : 30;

    const created = await this.prisma.session.create({
      data: {
        gymId,
        trainerId,
        name: dto.name,
        capacity,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        scheduledEndAt: dto.scheduledEndAt ? new Date(dto.scheduledEndAt) : undefined,
      },
    });

    // Let every active member at this gym know a new session just went
    // on the schedule, so it shows up as a notification-bell badge on
    // the Member App home screen and they can book a spot.
    if (created.scheduledAt) {
      const gymMembers = await this.prisma.member.findMany({
        where: { currentGymId: gymId, status: 'active' },
        select: { id: true },
      });
      await Promise.allSettled(
        gymMembers.map((m) =>
          this.notifications.notify({
            recipientType: 'member',
            recipientId: m.id,
            type: 'session_scheduled',
            title: 'New session scheduled',
            body: `"${created.name}" was just scheduled for ${created.scheduledAt!.toLocaleString()}. Tap to book your spot.`,
            data: { sessionId: created.id },
          }),
        ),
      );
    }

    return created;
  }

  listForGym(gymId: string, needsReassignment?: boolean) {
    return this.prisma.session.findMany({
      where: { gymId, ...(needsReassignment !== undefined ? { needsReassignment } : {}) },
      orderBy: { scheduledAt: 'desc' },
      include: { trainer: { select: { id: true, name: true } }, _count: { select: { members: true } } },
    });
  }

  listForTrainer(trainerId: string) {
    return this.prisma.session.findMany({ where: { trainerId }, orderBy: { scheduledAt: 'desc' }, include: { _count: { select: { members: true } } } });
  }

  async listAll(params: { skip?: number; take?: number }) {
    const skip = params.skip ?? 0;
    const take = params.take ?? 50;
    const [data, total] = await Promise.all([
      this.prisma.session.findMany({
        skip, take, orderBy: { createdAt: 'desc' },
        include: { gym: { select: { id: true, name: true } }, trainer: { select: { id: true, name: true } } },
      }),
      this.prisma.session.count(),
    ]);
    return { data, meta: { skip, take, total } };
  }

  async getById(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        trainer: { select: { id: true, name: true } },
        members: { include: { member: { select: { id: true, name: true, memberCode: true } } } },
      },
    });
    if (!session) throw new NotFoundException('Session not found.');
    return session;
  }

  // Per-second BPM history for one member within one session — powers
  // the leaderboard → member drill-down graph (spec: "click the member
  // to see the member stat on the session"). Scoped to gymId so a
  // branch can only pull ticks for sessions run at their own gym.
  async getAthleteTicks(sessionId: string, memberId: string, gymId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.gymId !== gymId) throw new NotFoundException('Session not found.');

    const sessionMember = await this.prisma.sessionMember.findUnique({
      where: { sessionId_memberId: { sessionId, memberId } },
    });
    if (!sessionMember) throw new NotFoundException('This member was not enrolled in that session.');

    const readings = await this.prisma.sensorReading.findMany({
      where: { sessionMemberId: sessionMember.id },
      orderBy: { ts: 'asc' },
    });
    return { ticks: readings.map((r) => ({ ts: r.ts.getTime(), bpm: r.hr, zone: 0, pctMhr: null })) };
  }

  /**
   * The one shared enrollment path referenced by all three client specs
   * (Branch Portal add, Trainer App add, Member App self-book) — spec §7
   * is explicit this must exist as ONE service function. Fixed from an
   * earlier version that only wrapped the count-check in a transaction
   * without a row lock: under Postgres's default READ COMMITTED
   * isolation, two *different* members racing the last open seat could
   * both observe count < capacity and both insert, overshooting
   * capacity — the UNIQUE(session_id, member_id) constraint only
   * catches the SAME member double-booking, not that. `SELECT ... FOR
   * UPDATE` on the parent session row serializes concurrent enrollment
   * attempts for that session, so the second transaction re-checks the
   * count only after the first has committed or rolled back.
   */
  async enrollMember(sessionId: string, memberId: string, enrolledBy: 'branch' | 'trainer' | 'member_self_book', scopeGymId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string; gym_id: string; capacity: number; status: string }[]>`
        SELECT id, gym_id, capacity, status FROM sessions WHERE id = ${sessionId} FOR UPDATE
      `;
      if (locked.length === 0) throw new NotFoundException('Session not found.');
      const session = locked[0];

      if (scopeGymId && session.gym_id !== scopeGymId) throw new ForbiddenException('This session belongs to a different branch.');
      if (session.status === 'completed' || session.status === 'cancelled') {
        throw new BadRequestException(`Cannot add a member to a ${session.status} session.`);
      }

      const member = await tx.member.findUnique({ where: { id: memberId } });
      if (!member) throw new NotFoundException('Member not found.');
      if (member.currentGymId !== session.gym_id) {
        throw new ForbiddenException('This member is not assigned to the gym running this session.');
      }

      const currentCount = await tx.sessionMember.count({ where: { sessionId } });
      if (currentCount >= session.capacity) {
        throw new AppException('SESSION_FULL', 'This session is at capacity.', 409);
      }

      try {
        return await tx.sessionMember.create({ data: { sessionId, memberId, enrolledBy } });
      } catch (e: any) {
        if (e.code === 'P2002') throw new ConflictException('This member is already enrolled in this session.');
        throw e;
      }
    });
  }

  async removeMember(sessionId: string, memberId: string, scopeGymId?: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found.');
    if (scopeGymId && session.gymId !== scopeGymId) throw new ForbiddenException('This session belongs to a different branch.');
    const row = await this.prisma.sessionMember.findUnique({ where: { sessionId_memberId: { sessionId, memberId } } });
    if (!row) throw new NotFoundException('This member is not enrolled in this session.');
    if (row.resultSubmittedAt) throw new BadRequestException('Cannot remove a member who already has results recorded.');
    await this.prisma.sessionMember.delete({ where: { id: row.id } });
    return { ok: true };
  }

  /** Member self-cancel — frees the slot, only while the session hasn't started yet (spec §7). */
  async memberSelfCancel(sessionId: string, memberId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found.');
    if (session.status !== 'scheduled') throw new BadRequestException('Cannot cancel a booking once the session has started.');
    const row = await this.prisma.sessionMember.findUnique({ where: { sessionId_memberId: { sessionId, memberId } } });
    if (!row) throw new NotFoundException('You are not booked into this session.');
    await this.prisma.sessionMember.delete({ where: { id: row.id } });
    return { ok: true };
  }

  async start(sessionId: string, trainerId: string) {
    const session = await this.assertOwnedByTrainer(sessionId, trainerId);
    if (session.status !== 'scheduled') throw new BadRequestException(`Cannot start a session that is ${session.status}.`);
    return this.prisma.session.update({ where: { id: sessionId }, data: { status: 'in_progress', startedAt: new Date() } });
  }

  /** Set at session start / during the session — trainer marks each enrolled member's attendance (spec §7). */
  async setAttendance(sessionId: string, memberId: string, attendance: 'enrolled' | 'attended' | 'no_show', trainerId: string) {
    await this.assertOwnedByTrainer(sessionId, trainerId);
    const row = await this.prisma.sessionMember.findUnique({ where: { sessionId_memberId: { sessionId, memberId } } });
    if (!row) throw new NotFoundException('This member is not enrolled in this session.');
    return this.prisma.sessionMember.update({ where: { id: row.id }, data: { attendance } });
  }

  /**
   * Idempotent by session_id + member_id (spec §7): a retried upload
   * from a trainer's offline outbox can never double-write results,
   * because this is an upsert keyed on the same UNIQUE(session_id,
   * member_id) constraint enrollment already uses — never a blind
   * insert. Also the receiving side of §13's offline-sync ingestion:
   * rejects a submission for a session never started, or for a member
   * never enrolled in it.
   */
  async end(sessionId: string, dto: EndSessionDto, trainerId: string) {
    const session = await this.assertOwnedByTrainer(sessionId, trainerId);
    if (session.status === 'scheduled') throw new BadRequestException('Cannot end a session that was never started.');

    await this.prisma.$transaction(async (tx) => {
      for (const r of dto.results) {
        const enrolled = await tx.sessionMember.findUnique({ where: { sessionId_memberId: { sessionId, memberId: r.memberId } } });
        if (!enrolled) {
          throw new BadRequestException(`Member ${r.memberId} was never enrolled in this session — cannot submit a result for them.`);
        }
        await tx.sessionMember.update({
          where: { sessionId_memberId: { sessionId, memberId: r.memberId } },
          data: {
            avgHr: r.avgHr, maxHr: r.maxHr, calories: r.calories, zoneMinutes: r.zoneMinutes as any, score: r.score,
            resultSubmittedAt: enrolled.resultSubmittedAt ?? new Date(),
            syncedAt: new Date(),
            attendance: enrolled.attendance === 'enrolled' ? 'attended' : enrolled.attendance,
          },
        });
      }
      if (session.status !== 'completed') {
        await tx.session.update({ where: { id: sessionId }, data: { status: 'completed', endedAt: new Date() } });
      }
    });

    await this.auditLog.record({ actorType: 'staff', actorId: trainerId, action: 'session.end', targetType: 'session', targetId: sessionId, payload: { resultCount: dto.results.length } });

    for (const r of dto.results) {
      await this.notifications.notify({ recipientType: 'member', recipientId: r.memberId, type: 'result_ready', body: 'Your session results are ready.' });
    }
    return this.getById(sessionId);
  }

  /** Branch or trainer cancels the whole session — notifies every enrolled member (spec §7). */
  async cancel(sessionId: string, reason: string | undefined, actorType: 'trainer' | 'branch' | 'admin', actorId: string, scopeGymId?: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId }, include: { members: true } });
    if (!session) throw new NotFoundException('Session not found.');
    if (scopeGymId && session.gymId !== scopeGymId) throw new ForbiddenException('This session belongs to a different branch.');
    if (session.status === 'completed') throw new BadRequestException('Cannot cancel a completed session.');

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: 'cancelled', cancelledReason: reason, cancelledByType: actorType, cancelledById: actorId, needsReassignment: false },
    });
    await this.auditLog.record({ actorType: actorType === 'admin' ? 'admin' : 'staff', actorId, action: 'session.cancel', targetType: 'session', targetId: sessionId, payload: { reason } });

    for (const m of session.members) {
      await this.notifications.notify({
        recipientType: 'member', recipientId: m.memberId, type: 'session_cancelled',
        title: 'Session cancelled', body: reason ? `Your session was cancelled: ${reason}` : 'Your session was cancelled.',
      });
    }
    return { ok: true };
  }

  // ── Member-facing ────────────────────────────────────────────────────
  listForMember(memberId: string) {
    return this.prisma.sessionMember.findMany({
      where: { memberId },
      include: { session: { include: { gym: { select: { name: true } }, trainer: { select: { name: true } } } } },
      orderBy: { enrolledAt: 'desc' },
    });
  }

  /**
   * Member App "Book a Session" list — every future scheduled session at
   * the member's own gym they haven't already booked, newest-scheduled
   * first, with a live open-spots count so the UI can show "Full"
   * without a second round trip. Capacity here is always the gym's
   * sensor-slot count (see create()), never a trainer-picked number.
   */
  async listAvailableForMember(memberId: string) {
    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member?.currentGymId) return [];

    const [sessions, myBookings] = await Promise.all([
      this.prisma.session.findMany({
        where: { gymId: member.currentGymId, status: 'scheduled', scheduledAt: { gt: new Date() } },
        orderBy: { scheduledAt: 'asc' },
        include: { trainer: { select: { id: true, name: true } }, _count: { select: { members: true } } },
      }),
      this.prisma.sessionMember.findMany({ where: { memberId }, select: { sessionId: true } }),
    ]);
    const bookedIds = new Set(myBookings.map((b) => b.sessionId));
    return sessions.map((s) => ({
      ...s,
      isBooked: bookedIds.has(s.id),
      spotsOpen: Math.max(0, s.capacity - s._count.members),
    }));
  }

  // Member App workout-detail screen: tap a calendar date -> this one
  // session's own result row (avgHr/maxHr/calories/zoneMinutes/score).
  // EPOC/avg-zone/etc. are derived client-side from zoneMinutes by the
  // same formula-engine the Trainer App uses — nothing new to compute
  // server-side, this just needs to return the raw aggregate.
  async getForMember(sessionId: string, memberId: string) {
    const sessionMember = await this.prisma.sessionMember.findUnique({
      where: { sessionId_memberId: { sessionId, memberId } },
      include: { session: { include: { gym: { select: { name: true } }, trainer: { select: { name: true } } } } },
    });
    if (!sessionMember) throw new NotFoundException('Session not found for this member.');
    return sessionMember;
  }

  // Same BPM-tick drill-down as getAthleteTicks (Branch Portal), but
  // scoped to the calling member's own membership rather than a gymId
  // — a member can only ever pull their own tick history.
  async getMemberTicks(sessionId: string, memberId: string) {
    const sessionMember = await this.prisma.sessionMember.findUnique({
      where: { sessionId_memberId: { sessionId, memberId } },
    });
    if (!sessionMember) throw new NotFoundException('Session not found for this member.');

    const readings = await this.prisma.sensorReading.findMany({
      where: { sessionMemberId: sessionMember.id },
      orderBy: { ts: 'asc' },
    });
    return { ticks: readings.map((r) => ({ ts: r.ts.getTime(), bpm: r.hr })) };
  }

  async selfBook(sessionId: string, memberId: string) {
    return this.enrollMember(sessionId, memberId, 'member_self_book');
  }

  /**
   * Optional raw HR stream ingestion for a future full BPM graph view
   * (spec §5's `sensor_readings` table) — the Trainer App's BLE layer
   * can batch-upload these during or after a session. Purely additive:
   * the aggregate fields on SessionMember (avgHr/maxHr/zoneMinutes/
   * score) written by end() are always sufficient on their own for
   * scoring, so a trainer app that never calls this endpoint loses
   * nothing but the detailed graph.
   */
  async ingestReadings(sessionId: string, readings: { memberId: string; ts: string; hr: number; rrMs?: number }[], trainerId: string) {
    await this.assertOwnedByTrainer(sessionId, trainerId);

    // Resolve each memberId to its session_members row up front so a
    // reading for a member never enrolled in this session is rejected
    // outright, same posture as end()'s validation.
    const memberIds = [...new Set(readings.map((r) => r.memberId))];
    const enrolledRows = await this.prisma.sessionMember.findMany({ where: { sessionId, memberId: { in: memberIds } } });
    const bySessionMemberId = new Map(enrolledRows.map((row) => [row.memberId, row.id]));

    const missing = memberIds.filter((id) => !bySessionMemberId.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Member(s) not enrolled in this session, cannot record readings: ${missing.join(', ')}`);
    }

    await this.prisma.sensorReading.createMany({
      data: readings.map((r) => ({
        sessionMemberId: bySessionMemberId.get(r.memberId)!,
        ts: new Date(r.ts),
        hr: r.hr,
        rrMs: r.rrMs,
      })),
    });
    return { ok: true, count: readings.length };
  }

  private async assertOwnedByTrainer(sessionId: string, trainerId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found.');
    if (session.trainerId !== trainerId) throw new ForbiddenException('This session belongs to a different trainer.');
    return session;
  }

  // ── Called by TrainersService on suspend, and by the auto-cancel cron ──
  /** Flags every future scheduled session owned by a newly-suspended trainer (spec §8, step 1-2). */
  async flagSessionsForReassignment(trainerId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { trainerId, status: 'scheduled', scheduledAt: { gt: new Date() } },
      data: { needsReassignment: true },
    });
    return result.count;
  }

  /** Fallback path: a flagged session nobody reassigned, now past its start time — auto-cancel + notify (spec §8, step 4). */
  async autoCancelOverdueFlagged(): Promise<number> {
    const overdue = await this.prisma.session.findMany({
      where: { needsReassignment: true, status: 'scheduled', scheduledAt: { lt: new Date() } },
      include: { members: true },
    });
    for (const session of overdue) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { status: 'cancelled', cancelledReason: 'Trainer suspended, no reassignment made in time', cancelledByType: 'system', needsReassignment: false },
      });
      for (const m of session.members) {
        await this.notifications.notify({
          recipientType: 'member', recipientId: m.memberId, type: 'session_cancelled',
          title: 'Session cancelled', body: 'Your session was cancelled because no trainer was reassigned in time.',
        });
      }
    }
    return overdue.length;
  }

  /** Branch reassigns a flagged session to a different trainer at the same gym. */
  async reassignTrainer(sessionId: string, newTrainerId: string, gymId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found.');
    if (session.gymId !== gymId) throw new ForbiddenException('This session belongs to a different branch.');
    const trainer = await this.prisma.trainer.findUnique({ where: { id: newTrainerId } });
    if (!trainer || trainer.gymId !== gymId || trainer.status !== 'active') {
      throw new BadRequestException('The selected trainer is not an active member of your branch.');
    }
    return this.prisma.session.update({ where: { id: sessionId }, data: { trainerId: newTrainerId, needsReassignment: false } });
  }
}
