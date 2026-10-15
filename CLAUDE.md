# Pulse

Learning project: a campaign and coupon engine. Fastify API, BullMQ workers, Postgres, Redis, event-driven core (outbox + Redis Streams), SolidJS 2 dashboard.

## How we work: spec-driven
- Specs in `specs/NNN-name/` are the source of truth. Read `spec.md` and the relevant task in `tasks.md` before touching code.
- Never implement behaviour that isn't in the spec. If the spec is wrong or unclear, stop and say so.
- If implementation must differ from the spec, update `spec.md` in the same change.
- One task per session. Don't read files unrelated to the current task.

## Layout
- `apps/api`: Fastify (routes → services → repository interfaces → pg implementations)
- `apps/worker`: BullMQ workers, outbox relay, stream consumers
- `apps/web`: SolidJS 2 (see `.claude/rules/web.md`)
- `packages/shared`: DTOs, event types, schemas
- `db/migrations`: plain SQL (node-pg-migrate)

## Commands
- `pnpm dev`: run everything
- `pnpm test`: Vitest (unit)
- `pnpm test:int`: integration tests (Testcontainers)
- `pnpm lint` / `pnpm typecheck`
- `pnpm db:migrate` / `pnpm db:seed`

## Conventions
- TypeScript strict. No `any`.
- Services depend on interfaces only; wiring happens in `apps/api/src/container.ts`.
- Every state change that emits an event writes to `outbox` in the same transaction.
- Consumers must be idempotent (record processed event IDs).
- Tests come from the spec's acceptance criteria; name them after the criterion ID (e.g. `AC-2`).

## Definition of done (every task)
`pnpm lint && pnpm typecheck && pnpm test` pass, the task's own check passes, and the task is ticked in `tasks.md`.
