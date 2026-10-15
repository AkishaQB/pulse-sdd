---
paths:
  - "apps/api/**"
  - "apps/worker/**"
---

# Backend rules

- Route files: HTTP only. Validate with JSON schema, call one service method, map the result. No SQL, no Redis calls.
- Services: business rules only. Depend on interfaces from `*.repository.ts` / `*.port.ts`, injected via `container.ts`.
- Repositories: one interface per aggregate; Postgres implementation named `Pg<Name>Repository`.
- Domain errors are classes in `errors.ts`; the central error handler maps them to HTTP codes. Never throw raw strings.
- Any write that emits an event: same transaction inserts into `outbox`.
- Redis keys are namespaced `pulse:<area>:<id>` and every cached key has a TTL.
- Workers: jobs must be safe to retry. Use the job ID or event ID for idempotency.
- Handle SIGTERM: stop taking new work, finish in-flight jobs, close connections.
