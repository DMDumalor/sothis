# SOTHIS 1618 Smart HR ERP

A secure, intelligent, multi-tenant HR ERP SaaS platform. See `docs/` (in this
repo) and the project's knowledge base docs (`sothis-1618-specification.md`,
`sothis-1618-architecture-plan.md`, `sothis-1618-blueprint.md`,
`sothis-1618-ui-reference.md`, `sothis-1618-handoff.md`) for the full
requirements, architecture decisions, and current build status.

## Stack

- **Backend**: NestJS 10 + TypeScript, Prisma 7 (Postgres driver adapter,
  `@prisma/adapter-pg` — no native engine binary at runtime), PostgreSQL 16,
  Passport JWT, class-validator, Swagger/OpenAPI, Jest.
- **Frontend**: React 19 + TypeScript + Vite, React Router 7, TanStack
  Query, Tailwind CSS v4, Recharts, Zustand, Axios.

## Prerequisites

- Node.js 20+
- PostgreSQL 16 running locally (or reachable via `DATABASE_URL`)

## Backend setup

```bash
cd backend
cp .env.example .env   # then fill in JWT_ACCESS_SECRET / JWT_REFRESH_SECRET
npm install
npm run prisma:generate
npm run prisma:migrate   # creates the schema in your database
npm run prisma:seed      # seeds two tenants, roles, permissions, demo data
npm run start:dev
```

The API listens on `http://localhost:3000/api`, with Swagger docs at
`http://localhost:3000/api/docs`.

> **Note on Prisma tooling and sandboxed/restricted networks**: Prisma's CLI
> downloads its schema/migration engine binary from `binaries.prisma.sh` on
> first use. If your environment only allows npm-registry traffic, add
> `binaries.prisma.sh` to the allowlist as well — `npm install` alone is not
> enough. The generated `@prisma/client` itself does **not** need a native
> engine at runtime because the app uses Prisma's `driverAdapters` preview
> feature with `@prisma/adapter-pg` (plain `pg` under the hood).

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` and proxies `/api/*` to the
backend (see `vite.config.ts`).

## Demo accounts (organization code: `SOTHIS-1618`)

All seeded users share the password `Sothis@Demo2026` — a development-only
credential, never a production secret (spec section 50).

| Role | Email |
|---|---|
| Admin | admin@sothis1618.com |
| HR | hr@sothis1618.com |
| Department Head (IT) | depthead@sothis1618.com |
| Finance | finance@sothis1618.com |
| DG | dg@sothis1618.com |
| Employee | employee@sothis1618.com |

A second tenant, `ACME-CORP` (HR login `hr@acmecorp.example`, same demo
password), exists purely so tenant-isolation tests have a second
organization's real data to probe (spec section 48).

## What's implemented (M1 — Foundation)

- Full Prisma schema covering every entity in the spec (tenancy, RBAC,
  employees, leave, attendance, payroll, notifications, audit/security,
  smart insights).
- Login by organization code + email + password, with tenant resolution,
  argon2 password hashing, account lockout (5 attempts / 15 min, atomic
  counters), and generic failure messages that don't leak whether a tenant,
  email, or lock state exists.
- Rotating refresh tokens (hashed at rest) with reuse detection that revokes
  the whole token family and logs a HIGH-severity security event.
- Role + Permission + Scope (OWN/DEPARTMENT/TENANT) authorization, enforced
  server-side by `PermissionsGuard`, resolved fresh from the database on
  every request — never trusted from the frontend.
- Request-scoped `TenantContext` so tenant scoping always comes from the
  authenticated JWT, never from a route param/body/query value.
- Append-only `AuditLog` + `SecurityEvent` + `LoginAudit`.
- Account invitations: HR/Admin creates an invitation for an employee, the
  employee activates their account and sets a password.
- Seed script for two tenants, all 6 roles, the full permission catalog,
  departments/positions, ~13 demo employees, leave/attendance/overtime
  history, a payroll period with a deliberate anomaly, the matching Smart
  Insight, notifications, and sample audit/security events.
- Frontend: real login page wired to the API, silent session restore via
  refresh-token rotation, a role-aware sidebar/topbar shell, and a
  post-login page that reflects real `/auth/me` data rather than
  placeholder KPIs.

## What's next

Departments/positions/employee CRUD, leave, attendance/overtime, payroll,
reports, the DG dashboard, the Smart Intelligence engine's remaining
detectors, the Security Center UI, and notifications — each as a full
vertical slice, per the milestone plan in the architecture doc.
