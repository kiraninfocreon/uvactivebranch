// The e2e suite (suspension-cascade, v2-feature-access) deliberately
// makes real HTTP requests across multiple route realms in the same
// run — e.g. logging in via /auth/staff/login then calling
// /branch/members, or exercising /admin/*, /branch/*, and /member/*
// back to back in v2-feature-access.e2e-spec.ts. That only works if
// every realm is reachable, i.e. SERVICE_SCOPE=all.
//
// This fork's own default (see src/config/configuration.ts) is
// narrower — this repo only ever runs as one scope in production —
// so without this file, a plain `npm run test:e2e` would 404 on any
// route outside that narrower default and fail tests that have
// nothing wrong with them.
//
// Respects an explicit SERVICE_SCOPE if one is already set (e.g. you
// want to deliberately test the gating itself), otherwise forces 'all'.
process.env.SERVICE_SCOPE = process.env.SERVICE_SCOPE || 'all';
