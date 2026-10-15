# 001 – Plan

Written from `spec.md` (status: reviewed). No code here, only decisions.

## Approach
The repo has no code yet, so this spec also sets up the pnpm monorepo described in CLAUDE.md (infrastructure only, no extra behaviour). One SQL migration creates `segments` (stub), `campaigns`, `idempotency_keys` and `outbox`. `packages/shared` holds the DTOs, JSON schemas, error codes and event types. `apps/api` gets a `campaigns` module: routes → service → ports. Writes and their outbox inserts share one transaction through a `UnitOfWork` port. Service logic is unit-tested against in-memory fakes. Locking, races, cursor precision and outages are tested against real Postgres with Testcontainers.

## Files to add / change
| File | Change | Why (AC-ref) |
|---|---|---|
| `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.config.ts`, `eslint.config.js` | new (scaffold) | infrastructure, no AC |
| `db/migrations/001_campaigns.sql` | new: 4 tables, checks, FKs, indexes | all ACs (data); AC-12, AC-14 (indexes) |
| `packages/shared/src/campaign.ts` | `Campaign` DTO; create, patch, list-query and header JSON schemas | AC-1, AC-3a–e, AC-7, AC-15b–c, AC-17, AC-22, AC-23, AC-25 |
| `packages/shared/src/errors.ts` | error code enum + HTTP status map | all failure ACs |
| `packages/shared/src/events.ts` | `CampaignScheduled`, `CampaignCancelled` payload types | AC-31, AC-35 |
| `apps/api/src/app.ts` | Fastify build; remaps 413/415; central error handler | AC-3f, AC-38, AC-39 |
| `apps/api/src/errors.ts` | domain error classes | all failure ACs |
| `apps/api/src/container.ts` | wiring | — |
| `apps/api/src/ports/clock.port.ts` | `Clock` interface + `SystemClock` | AC-31, AC-32a–c |
| `apps/api/src/db/pool.ts` | pg pool with `PG_CONNECT_TIMEOUT_MS` (default 2000); connection errors → `ServiceUnavailableError` | AC-38 |
| `apps/api/src/modules/campaigns/campaign.repository.ts` | `CampaignRepository`, `OutboxRepository`, `IdempotencyRepository`, `UnitOfWork` interfaces | — |
| `apps/api/src/modules/campaigns/pg-campaign.repository.ts`, `pg-outbox.repository.ts`, `pg-idempotency.repository.ts`, `pg-unit-of-work.ts` | Postgres implementations: `FOR UPDATE`, keyset list, keyed upsert, FK 23503 → `SegmentNotFoundError` | AC-2, AC-6, AC-8, AC-9, AC-12, AC-26, AC-27, AC-28, AC-37, AC-39 |
| `apps/api/src/modules/campaigns/cursor.ts` | encode/decode base64url `{c, i}`; never goes through `Date` | AC-12, AC-15a |
| `apps/api/src/modules/campaigns/etag.ts` | format `ETag`, parse `If-Match` | AC-16, AC-17 |
| `apps/api/src/modules/campaigns/request-hash.ts` | canonical JSON + SHA-256 | AC-4, AC-5 |
| `apps/api/src/modules/campaigns/campaign.service.ts` | business rules, check order, outbox writes | AC-1, AC-2, AC-4, AC-5, AC-9, AC-10, AC-11a, AC-13, AC-14, AC-18–AC-24, AC-26, AC-29–AC-36 |
| `apps/api/src/modules/campaigns/campaign.routes.ts` | HTTP only: schemas, `ETag` / `If-Match` / `Idempotency-Key` / `Idempotent-Replayed` headers | AC-1, AC-4, AC-6, AC-10, AC-11b, AC-16, AC-17, AC-21 |
| `apps/api/test/fakes/*.ts` | in-memory repositories, `FakeUnitOfWork`, `FakeClock` | test support |
| `apps/api/test/int/*.int.test.ts` | Testcontainers flows | AC-6, AC-8, AC-9, AC-12, AC-27, AC-28, AC-37, AC-38, AC-39 |

Every AC maps to at least one planned change.

## Key decisions
- **Transactions behind a `UnitOfWork` port.** `uow.run(tx => …)` hands the service transaction-scoped repositories. Alternative considered: passing a `pg` client into the service. That was rejected because it breaks "services depend on interfaces only".
- **Check order lives in the service.** The repository returns the `FOR UPDATE`-locked row, and the service checks in the spec's order: not found → status → version → business rule. Alternative considered: a conditional `UPDATE` plus a re-read. That was rejected because it can't produce the AC-20 precedence deterministically.
- **The cursor is read as text.** The repository selects `created_at::text`, and keyset pagination compares `(created_at, id) < ($1::timestamptz, $2::uuid)`. This keeps microsecond precision (AC-12).
- **Idempotent create** uses `INSERT … ON CONFLICT (key) DO UPDATE … WHERE created_at < now() - '24h' RETURNING *`, as described in spec §6. The campaign id is generated in the app before the insert.
- **Concurrency tests** run requests in parallel with `Promise.all` against real Postgres. For AC-28 and AC-37, a test-only hook adds a `pg_sleep` between the `SELECT … FOR UPDATE` and the `UPDATE` so the requests reliably overlap.
- **Failure simulation:** AC-39 uses a throwing fake `OutboxRepository` (unit test) and a raising trigger on `outbox` (integration test). AC-38 points the pool at a closed port.

## Risks
- Scaffolding isn't specced behaviour and is the largest single task. It is kept minimal: no web app, worker or Redis.
- `ON CONFLICT DO UPDATE … WHERE` returns no row both for a live key and after waiting out a concurrent insert. The AC-6 integration test covers both paths.
- AC-28 and AC-37 can flake. The test-only `pg_sleep` hook makes the overlap reliable.
- Fastify's own 413/415 errors bypass our error shape unless re-mapped. AC-3f covers this.
- A wrong check order is easy to miss. AC-20 and AC-34 pin it.

## Test strategy
- **Unit (Vitest):** `campaign.service` with in-memory fakes and `FakeClock` for every business AC. Pure helpers: cursor, etag, request-hash. Shared JSON schemas. The error handler. Routes via `fastify.inject` with a fake service.
- **Integration (`pnpm test:int`, Testcontainers Postgres):** migration applies; keyed create race (AC-6); key expiry and replay after delete (AC-8, AC-9); keyset paging with tied timestamps (AC-12); write races (AC-27, AC-28, AC-37); outage (AC-38); outbox rollback (AC-39).
- **Load:** none in 001.
