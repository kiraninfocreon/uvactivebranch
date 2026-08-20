# UV Active — Branch Portal

Module 2/4 of the UV Active platform: branch-manager and trainer web
console (roster, trainers, sessions, transfer requests, sensors), wired
live to this repo's own backend (no mock data — every screen calls a real
endpoint).

## Stack

- React 18 + TypeScript + Vite (SWC)
- Tailwind + shadcn/ui (design tokens shared with the Admin Panel)
- TanStack Query for all server state
- Plain `fetch` client (`src/lib/api.ts`) — no axios dependency needed

## Backend

This repo owns its own backend, at `./backend` — a forked, branch-scoped
copy of `uvactive-cloud-api` that connects directly to the shared UV Active
Postgres database (see `backend/README.md` for the full backend docs, and
`render.yaml` at the repo root for how the two halves deploy together as
separate Render services from one blueprint). `uvactive-cloud-api` itself
no longer serves the Branch Portal at all — it's scoped to the Trainer App
and Member App only now.

```bash
cd backend
npm install
cp .env.example .env      # fill in DATABASE_URL + the three JWT secrets
docker compose up -d      # or point DATABASE_URL at your own Postgres
npm run prisma:migrate:dev
npm run start:dev         # listens on :8080 by default, SERVICE_SCOPE=branch
```

## Running it

```bash
npm install
cp .env.example .env   # points VITE_API_BASE_URL at the backend above
npm run dev
```

The backend (`./backend`) must be running separately, default
`http://localhost:8080`, global prefix `/api/v1`. CORS on the backend needs
to allow this app's origin — check `CORS_ORIGINS` in `backend/.env`.

Staff (branch_manager/trainer) accounts are created via the Admin Panel's
own backend (`/admin/*` — Admin Panel and Branch Portal share the same
underlying `Staff` table through the same database, just via two different
backend deployments).

## Project structure

```
src/
  components/branch/   # branch-scoped UI components
  hooks/branch/         # branch-scoped data hooks (TanStack Query)
  lib/                  # api client, auth context, Google Identity, types
  pages/branch/         # routed pages
backend/                # this app's own NestJS + Prisma backend (see backend/README.md)
```
