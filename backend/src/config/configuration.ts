// Central place every module reads env from via ConfigService — no
// module should call process.env directly, so this file is the single
// spot to check when adding a new setting.
export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8080', 10),

  // This is the Branch Portal's own forked copy of uvactive-cloud-api
  // (see repo root README for why it was split out). Default is
  // "branch", not "all" — if SERVICE_SCOPE is ever left unset on a
  // real deployment, this fork should fail closed to branch-only
  // routes rather than silently exposing /admin/* and the
  // trainer/member routes too. Override to "all" only for local
  // testing against routes outside this app's own scope.
  serviceScope: (process.env.SERVICE_SCOPE || 'branch') as 'admin' | 'branch' | 'public' | 'all',

  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || null,

  jwt: {
    memberSecret: mustGet('JWT_MEMBER_SECRET'),
    staffSecret: mustGet('JWT_STAFF_SECRET'),
    adminSecret: mustGet('JWT_ADMIN_SECRET'),
    accessTtlMinMember: parseInt(process.env.ACCESS_TOKEN_TTL_MEMBER_MIN || '60', 10),
    accessTtlMinStaff: parseInt(process.env.ACCESS_TOKEN_TTL_STAFF_MIN || '15', 10),
    accessTtlMinAdmin: parseInt(process.env.ACCESS_TOKEN_TTL_ADMIN_MIN || '15', 10),
    refreshTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30', 10),
  },

  totp: {
    issuer: process.env.TOTP_ISSUER || 'UVActive',
  },

  // Google Identity Services client ID used to verify staff ("Sign in
  // with Google") ID tokens on the Branch Portal. Leave unset to
  // disable the Google button — staffGoogleLogin fails cleanly with a
  // clear message instead of the server crashing on missing config.
  google: {
    staffClientId: process.env.GOOGLE_STAFF_CLIENT_ID || null,
  },

  notifications: {
    expoPushAccessToken: process.env.EXPO_PUSH_ACCESS_TOKEN || null,
    smsProviderApiKey: process.env.SMS_PROVIDER_API_KEY || null,
    // Resend (https://resend.com) — production email provider. Leave
    // unset in dev/test and every "email" notification degrades to a
    // console-logged stub instead of failing (see NotificationsService).
    resendApiKey: process.env.RESEND_API_KEY || null,
    // Must be a verified sender on the Resend account/domain — Resend
    // rejects sends from an unverified address rather than silently
    // dropping them, so this is deliberately required-with-a-fallback
    // rather than silently defaulting to something that will 403.
    emailFrom: process.env.RESEND_FROM_EMAIL || 'UV Active <onboarding@resend.dev>',
  },

  branding: {
    // Used in the header of every branded HTML email (see
    // notifications/email-template.ts). Defaults to the asset already
    // committed to this repo's email templates — override only if the
    // logo moves to different hosting.
    logoUrl: process.env.EMAIL_LOGO_URL || 'https://iili.io/CSYLcnn.jpg',
    appName: 'UV Active',
  },

  storage: {
    bucket: process.env.S3_BUCKET || null,
    accessKey: process.env.S3_ACCESS_KEY || null,
    secretKey: process.env.S3_SECRET_KEY || null,
    endpoint: process.env.S3_ENDPOINT || null,
    region: process.env.S3_REGION || null,
  },

  corsOrigins: (process.env.CORS_ORIGINS || '*').split(',').map((s) => s.trim()),
});

function mustGet(key: string): string {
  const val = process.env[key];
  if (!val || val.length < 16) {
    // Fail fast at boot, not on the first request — same principle the
    // original cloud-api's auth.js used, applied per-realm now.
    throw new Error(
      `${key} env var is missing or too short (need 16+ chars). ` +
      `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }
  return val;
}
