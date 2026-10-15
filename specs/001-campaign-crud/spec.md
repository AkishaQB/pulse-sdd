# 001 – Campaign CRUD

**Status:** planned
**Phase:** 1
**Related specs:** [002 segments](../002-segments/spec.md), [005 broadcast-fanout](../005-broadcast-fanout/spec.md), [007 outbox-relay](../007-outbox-relay/spec.md)

## 1. Problem
Pulse has no way to define a campaign. Before anything can be sent, fanned out or measured, someone needs to create a campaign, edit it while it's a draft, schedule it for a segment and channel, and cancel it. Every later phase depends on campaigns existing with a well-defined status lifecycle.

## 2. Goal
A caller can create, read, list, update, delete, schedule and cancel campaigns through the API. Status transitions are enforced, and scheduling or cancelling writes an event to the outbox in the same transaction.

## 3. Non-goals
- Authentication, authorisation and per-campaign ownership. Any caller can do anything, including deleting drafts and cancelling any campaign. This is an accepted risk for the learning scope and is revisited when auth is specced.
- Sending messages, enqueueing BullMQ jobs, or the `sending`/`sent` transitions (005).
- Relaying outbox rows to Redis Streams, and consumer-side deduplication (007, 005).
- Segment management, membership and empty-segment handling (002 / 005). 001 only creates a stub `segments` table.
- Rescheduling a scheduled campaign. The caller cancels it and creates a new one.
- Cleaning up expired idempotency keys (a later spec).
- Coupons (003) and caching (004). Redis is not used in this spec.
- Message templating. `message` is plain text.
- Rate limiting. Dashboard UI (009).

## 4. Acceptance criteria
Tests are named after these IDs. "Write routes" means `PATCH /campaigns/:id`, `DELETE /campaigns/:id`, `POST /campaigns/:id/schedule` and `POST /campaigns/:id/cancel`. Time is read from an injected `Clock`, which tests fake.

### Create
- **AC-1:** Given segment S exists, when `POST /campaigns` is called with a valid `name`, `segmentId=S`, `channel` and `message`, plus optional `description`, `tags` and `scheduledAt`, then the response is 201 with the campaign, `status="draft"`, `version=1`, header `ETag: "1"`, and server-set `id`, `createdAt` and `updatedAt`.
- **AC-2 (failure):** Given no segment with id X exists, when `POST /campaigns` is called with `segmentId=X`, then the response is 422 `SEGMENT_NOT_FOUND` and no campaign row is created.
- **AC-3a (failure):** Given a body missing any of `name`, `segmentId`, `channel` or `message`, when `POST /campaigns` is called, then the response is 400 `VALIDATION_ERROR`.
- **AC-3b (failure):** Given `name` outside 1–120 chars, `message` outside 1–2000 chars, or `description` over 500 chars, then the response is 400 `VALIDATION_ERROR`.
- **AC-3c (failure):** Given `tags` with more than 10 items, an item not matching `^[a-z0-9-]{1,32}$`, or duplicate items, then the response is 400 `VALIDATION_ERROR`.
- **AC-3d (failure):** Given `segmentId` that isn't a UUID, `channel` not in `line|email|webhook`, or `scheduledAt` that isn't an ISO-8601 date-time, then the response is 400 `VALIDATION_ERROR`.
- **AC-3e (failure):** Given a body with an unknown property, then the response is 400 `VALIDATION_ERROR`.
- **AC-3f (failure):** Given a `Content-Type` other than `application/json`, then the response is 415 `UNSUPPORTED_MEDIA_TYPE`.
- **AC-4:** Given a previous `POST /campaigns` with `Idempotency-Key: K` returned 201 less than 24 h ago, when the same request is sent with key K and an identical body, then the response is 201 with the same body and the header `Idempotent-Replayed: true`, and no second row is created.
- **AC-5 (failure):** Given key K was used less than 24 h ago with body A, when `POST /campaigns` is sent with key K and a different body B, then the response is 422 `IDEMPOTENCY_KEY_REUSED` and no campaign is created.
- **AC-6 (concurrency):** Given key K is unused, when two `POST /campaigns` requests with key K and identical bodies are sent in parallel, then exactly one campaign row exists, both responses are 201 with the same `id`, and exactly one of them carries `Idempotent-Replayed: true`.
- **AC-7 (failure):** Given an `Idempotency-Key` that is empty or longer than 128 chars, then the response is 400 `VALIDATION_ERROR`.
- **AC-8:** Given key K was last used 24 h or more ago, when `POST /campaigns` is sent with key K, then it is treated as a new key: a new campaign is created and the response is 201 without `Idempotent-Replayed`.
- **AC-9 (failure):** Given a campaign created with key K was later deleted, when the same request is replayed with key K within 24 h, then the response is 404 `CAMPAIGN_NOT_FOUND` and no campaign is created.

### Read
- **AC-10:** Given campaign C exists with `version=n`, when `GET /campaigns/C` is called, then the response is 200 with the full campaign and `ETag: "n"`.
- **AC-11a (failure):** Given no campaign with id X exists, when `GET /campaigns/X` is called, then the response is 404 `CAMPAIGN_NOT_FOUND`.
- **AC-11b (failure):** Given `:id` isn't a UUID, when `GET /campaigns/:id` or any write route is called, then the response is 400 `VALIDATION_ERROR`.

### List
- **AC-12:** Given 25 campaigns exist, including at least 3 with the same `createdAt`, when `GET /campaigns?limit=10` is called and `nextCursor` is followed until it is `null`, then all 25 are returned exactly once, ordered by `createdAt` desc, then `id` desc.
- **AC-13:** Given 25 campaigns exist, when `GET /campaigns` is called without `limit`, then 20 items and a non-null `nextCursor` are returned.
- **AC-14:** Given campaigns in several statuses, when `GET /campaigns?status=scheduled` is called and paged through, then only `scheduled` campaigns are returned, with the same ordering and paging as AC-12. All five status values are accepted.
- **AC-15a (failure):** Given a `cursor` that isn't valid base64url JSON of the expected shape, then the response is 400 `VALIDATION_ERROR`.
- **AC-15b (failure):** Given an unknown `status` value, then the response is 400 `VALIDATION_ERROR`.
- **AC-15c (failure):** Given `limit` < 1, > 100, or not an integer, then the response is 400 `VALIDATION_ERROR`.

### Write preconditions (all write routes)
Checks run in this order, and the first failure wins: 400/415/428 (request) → 404 → 409 `INVALID_STATUS_TRANSITION` → 409 `VERSION_CONFLICT` → 422 (business rule).
- **AC-16 (failure):** Given a write route is called without `If-Match`, then the response is 428 `PRECONDITION_REQUIRED` and nothing changes.
- **AC-17 (failure):** Given an `If-Match` value that isn't `"<positive integer>"` (including `*`), then the response is 400 `VALIDATION_ERROR`.
- **AC-18 (failure):** Given no campaign with id X exists, when any write route is called on X with a well-formed `If-Match`, then the response is 404 `CAMPAIGN_NOT_FOUND`.
- **AC-19 (failure):** Given campaign C is in a status the route allows and has `version=n`, when the route is called with `If-Match: "m"` where m ≠ n, then the response is 409 `VERSION_CONFLICT`, nothing changes, and no outbox row is written.
- **AC-20 (failure, precedence):** Given campaign C is in a status the route does not allow, when the route is called with a stale `If-Match`, then the response is 409 `INVALID_STATUS_TRANSITION`, not `VERSION_CONFLICT`.

### Update
- **AC-21:** Given draft C has `version=n`, when `PATCH /campaigns/C` is called with `If-Match: "n"` and a subset of editable fields, then only those fields change, `version` becomes n+1, `updatedAt` is refreshed, and the response is 200 with the campaign and `ETag: "n+1"`.
- **AC-22:** Given draft C, when `PATCH` sets `description` or `scheduledAt` to `null`, then that field is cleared. Omitted fields are unchanged. `null` for any other field returns 400 `VALIDATION_ERROR`.
- **AC-23 (failure):** Given a `PATCH` body with no editable fields (`{}`), then the response is 400 `VALIDATION_ERROR` and `version` is unchanged.
- **AC-24 (failure):** Given C is `scheduled`, `cancelled`, `sending` or `sent`, when `PATCH` is called, then the response is 409 `INVALID_STATUS_TRANSITION`.
- **AC-25 (failure):** Given a `PATCH` body that sets `id`, `status`, `version`, `createdAt` or `updatedAt`, or that breaks any rule in AC-3b–3d, then the response is 400 `VALIDATION_ERROR`.
- **AC-26 (failure):** Given draft C, when `PATCH` sets `segmentId` to a segment that doesn't exist, then the response is 422 `SEGMENT_NOT_FOUND` and nothing changes.
- **AC-27 (concurrency):** Given draft C has `version=n`, when two `PATCH` requests with `If-Match: "n"` and different `name`s are sent in parallel, then exactly one returns 200 and the other 409 `VERSION_CONFLICT`, and the final row has `version=n+1` and the winner's `name`.
- **AC-28 (concurrency):** Given draft C has `version=n` and a valid `scheduledAt`, when a `PATCH` and a `POST /schedule`, both with `If-Match: "n"`, are sent in parallel, then exactly one succeeds. If schedule won, the status is `scheduled` with one outbox row. If PATCH won, the status is `draft` with zero outbox rows.

### Delete
- **AC-29:** Given draft C has `version=n`, when `DELETE /campaigns/C` is called with `If-Match: "n"`, then the response is 204 and `GET /campaigns/C` returns 404.
- **AC-30 (failure):** Given C isn't `draft`, when `DELETE` is called, then the response is 409 `INVALID_STATUS_TRANSITION` and the row remains.

### Schedule
- **AC-31:** Given draft C has `version=n` and `scheduledAt ≥ clock.now() + 60 s`, when `POST /campaigns/C/schedule` is called with `If-Match: "n"`, then `status` becomes `scheduled`, `version` becomes n+1, and the response is 200. In the same transaction, exactly one outbox row is written with `event_type='CampaignScheduled'`, `aggregate_id=C`, a fresh UUID `event_id`, `occurred_at=clock.now()`, and the payload in §7.
- **AC-32a (failure):** Given draft C has `scheduledAt = null`, when schedule is called, then the response is 422 `SCHEDULED_AT_INVALID`, the status stays `draft`, and there is no outbox row.
- **AC-32b (failure):** Given draft C has `scheduledAt = clock.now() + 59.999 s`, when schedule is called, then the response is 422 `SCHEDULED_AT_INVALID`.
- **AC-32c (boundary):** Given draft C has `scheduledAt = clock.now() + 60 s` exactly, when schedule is called, then it succeeds as in AC-31.
- **AC-33 (failure):** Given C isn't `draft`, when schedule is called, then the response is 409 `INVALID_STATUS_TRANSITION` and no outbox row is written.
- **AC-34 (retry):** Given schedule succeeded on C with `If-Match: "n"`, when the identical request is retried, then the response is 409 `INVALID_STATUS_TRANSITION` and C still has exactly one `CampaignScheduled` outbox row.

### Cancel
- **AC-35:** Given C is `draft` or `scheduled` with `version=n`, when `POST /campaigns/C/cancel` is called with `If-Match: "n"`, then `status` becomes `cancelled`, `version` becomes n+1, and the response is 200. In the same transaction, exactly one `CampaignCancelled` outbox row is written with `previousStatus` set to the old status.
- **AC-36 (failure):** Given C is `cancelled`, `sending` or `sent` (the latter two seeded directly in the test), when cancel is called, then the response is 409 `INVALID_STATUS_TRANSITION` and no outbox row is written.
- **AC-37 (concurrency):** Given scheduled C has `version=n`, when two cancel requests with `If-Match: "n"` are sent in parallel, then exactly one returns 200, the other returns 409 `INVALID_STATUS_TRANSITION`, and exactly one `CampaignCancelled` row exists.

### Infrastructure
- **AC-38 (failure):** Given Postgres is unreachable, when any campaign endpoint is called, then the response is 503 `SERVICE_UNAVAILABLE` within `PG_CONNECT_TIMEOUT_MS` + 1 s, and the body contains no internal error details.
- **AC-39 (failure, atomicity):** Given the outbox insert fails during schedule or cancel, then the transaction rolls back, the campaign's status and version are unchanged, and the response is 500 `INTERNAL_ERROR`.

## 5. API contract
All bodies are JSON. Ids are UUIDs. Errors use the shape `{ "error": { "code": string, "message": string } }`. Fastify's default body limit (1 MiB, returning 413) applies.

| Method | Path | Request | Success | Errors |
|---|---|---|---|---|
| POST | /campaigns | Header `Idempotency-Key?` (1–128 chars); `{ name, segmentId, channel, message, description?, tags?, scheduledAt? }` | 201 `Campaign` + `ETag`; replay adds `Idempotent-Replayed: true` | 400, 404 (replay after delete), 415, 422 SEGMENT_NOT_FOUND, 422 IDEMPOTENCY_KEY_REUSED, 500, 503 |
| GET | /campaigns/:id | – | 200 `Campaign` + `ETag` | 400, 404, 500, 503 |
| GET | /campaigns | `?status=&limit=(1–100, default 20)&cursor=` | 200 `{ items: Campaign[], nextCursor: string \| null }` | 400, 500, 503 |
| PATCH | /campaigns/:id | `If-Match`; `{ name?, segmentId?, channel?, message?, description?, tags?, scheduledAt? }` (≥1 field) | 200 `Campaign` + `ETag` | 400, 404, 409 INVALID_STATUS_TRANSITION, 409 VERSION_CONFLICT, 415, 422 SEGMENT_NOT_FOUND, 428, 500, 503 |
| DELETE | /campaigns/:id | `If-Match` | 204 | 400, 404, 409 ×2, 428, 500, 503 |
| POST | /campaigns/:id/schedule | `If-Match`; no body | 200 `Campaign` + `ETag` | 400, 404, 409 ×2, 422 SCHEDULED_AT_INVALID, 428, 500, 503 |
| POST | /campaigns/:id/cancel | `If-Match`; no body | 200 `Campaign` + `ETag` | 400, 404, 409 ×2, 428, 500, 503 |

`Campaign` = `{ id, name, segmentId, channel, message, description, tags, scheduledAt, status, version, createdAt, updatedAt }`
- `channel`: `"line" | "email" | "webhook"`
- `status`: `"draft" | "scheduled" | "sending" | "sent" | "cancelled"` (`sending`/`sent` are set only by 005)
- Timestamps are ISO-8601 UTC with microsecond precision. `scheduledAt` and `description` may be `null`. `tags` defaults to `[]`.
- `ETag` is the strong tag `"<version>"`. `If-Match` must be exactly that form.
- `cursor` is base64url of `{"c": "<created_at as Postgres text, microsecond precision>", "i": "<id>"}`. It is never parsed through a JS `Date`.
- `Idempotency-Key` applies only to `POST /campaigns`.

**Error codes:** `VALIDATION_ERROR` 400, `CAMPAIGN_NOT_FOUND` 404, `PAYLOAD_TOO_LARGE` 413, `UNSUPPORTED_MEDIA_TYPE` 415, `INVALID_STATUS_TRANSITION` 409, `VERSION_CONFLICT` 409, `SEGMENT_NOT_FOUND` 422, `IDEMPOTENCY_KEY_REUSED` 422, `SCHEDULED_AT_INVALID` 422, `PRECONDITION_REQUIRED` 428, `INTERNAL_ERROR` 500, `SERVICE_UNAVAILABLE` 503.

DTOs, JSON schemas and error codes live in `packages/shared`.

**Status transitions (001 only)**
```
draft ──schedule──▶ scheduled
draft ──cancel────▶ cancelled
scheduled ──cancel▶ cancelled
draft ──delete────▶ (row removed)
```

## 6. Data model
001's migration creates all three tables below. 002 alters `segments` and 007 only reads `outbox`.

- **`segments`** (stub): `id uuid pk`, `name text not null`, `created_at timestamptz not null default now()`. Tests insert segment rows directly.
- **`campaigns`**: `id uuid pk`, `name text not null`, `segment_id uuid not null`, `channel text not null`, `message text not null`, `description text null`, `tags text[] not null default '{}'`, `scheduled_at timestamptz null`, `status text not null default 'draft'`, `version int not null default 1`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`. The repository sets `updated_at` on every write.
- **`idempotency_keys`**: `key text pk`, `request_hash text not null`, `campaign_id uuid not null`, `response_status int not null`, `created_at timestamptz not null default now()`. There is no FK to `campaigns`, so the row survives a draft delete (AC-9). Keys are global because there is no auth.
- **`outbox`**: `id bigserial pk`, `event_id uuid not null unique`, `aggregate_type text not null`, `aggregate_id uuid not null`, `event_type text not null`, `payload jsonb not null`, `occurred_at timestamptz not null`, `published_at timestamptz null`

**Constraints**
- `campaigns.segment_id` FK → `segments.id` `ON DELETE RESTRICT`. FK violation `23503` maps to 422 `SEGMENT_NOT_FOUND`.
- CHECK `channel in ('line','email','webhook')` and CHECK `status in ('draft','scheduled','sending','sent','cancelled')`
- CHECK `char_length(name) between 1 and 120`, `char_length(message) between 1 and 2000`, `description is null or char_length(description) <= 500`, `cardinality(tags) <= 10`, `version >= 1`
- CHECK `status <> 'scheduled' or scheduled_at is not null`
- The per-tag pattern and dedup rules are enforced by the JSON schema only, not in the database.

**Indexes and the query each one serves**
- `campaigns (created_at desc, id desc)`: unfiltered keyset list (AC-12, AC-13)
- `campaigns (status, created_at desc, id desc)`: status-filtered keyset list (AC-14)
- `outbox (id) where published_at is null`: the relay's "next unpublished rows" query (007). Created here so 007 needs no migration.
- No `campaigns(segment_id)` index in 001. It is deferred to 002, which owns segment deletes.

**Transactions**
- **Writes (PATCH, DELETE, schedule, cancel):** one transaction runs `SELECT … FROM campaigns WHERE id = $1 FOR UPDATE`. The service then checks, in order: not found → status → version → business rule. It then issues the `UPDATE`/`DELETE` and, for schedule and cancel, the `INSERT INTO outbox`, then commits. The row lock serialises concurrent writes (AC-27, AC-28, AC-37), and 005 must take the same lock when moving a campaign to `sending`.
- **Create with key:** the app generates the campaign id. One transaction runs:
  1. `INSERT INTO idempotency_keys … ON CONFLICT (key) DO UPDATE SET … WHERE idempotency_keys.created_at < now() - interval '24 hours' RETURNING *`. This blocks on a concurrent insert of the same key until that transaction ends.
  2. If a row is returned, insert the campaign and commit.
  3. If no row is returned, the key is live. Read it, compare `request_hash` (AC-5), load the campaign (AC-4, or AC-9 if it's gone), and commit nothing new.
- **Create without key:** a plain insert.
- **`request_hash`:** SHA-256 of the canonical JSON of the validated body after defaults are applied (`tags: []`, `description: null`, `scheduledAt: null`), with keys sorted. Headers are not included.

## 7. Events
Written to `outbox` in the same transaction as the status change (AC-31, AC-35, AC-39). `aggregate_type='campaign'`.

| Event | Emitted when | Payload | Consumers |
|---|---|---|---|
| `CampaignScheduled` | draft → scheduled | `{ eventId, campaignId, segmentId, channel, scheduledAt, version, occurredAt }` | 005 broadcast-fanout (via 007) |
| `CampaignCancelled` | draft/scheduled → cancelled | `{ eventId, campaignId, previousStatus, version, occurredAt }` | 005 broadcast-fanout (via 007) |

What 001 guarantees as the producer:
- `eventId` is a UUID generated by the app and unique across `outbox`.
- `occurredAt` comes from `Clock`.
- Within a campaign, `version` strictly increases across events, and `outbox.id` order matches commit order for that campaign, because of the row lock.

Cancelling a `draft` still emits `CampaignCancelled` (with `previousStatus='draft'`), on purpose, to keep the history complete. 005 may ignore it. Create, update and delete emit no events. How consumers deduplicate and order events is specified in 005/007.

## 8. Jobs / queues
None in 001. Enqueueing the send job is 005.

## 9. Caching / Redis
None in 001. Campaign caching is 004.

## 10. Edge cases & failure modes
- **Redis down:** no effect. 001 does not use Redis.
- **Postgres down:** 503 within the connect timeout (AC-38). `PG_CONNECT_TIMEOUT_MS` defaults to 2000.
- **Same create twice:** `Idempotency-Key` (AC-4–AC-9). Without a key, duplicates are allowed.
- **Retry of schedule/cancel after a lost response:** returns 409 `INVALID_STATUS_TRANSITION` because status is checked before version, and no second outbox row is written (AC-34). The client can `GET` the campaign to confirm the outcome.
- **Concurrent writes:** serialised by the row lock (AC-27, AC-28, AC-37).
- **Cancel racing 005's move to `sending`:** both take the row lock, so whichever runs second sees the new status.
- **Outbox insert fails:** full rollback (AC-39).
- **Segment deleted while referenced:** blocked by `ON DELETE RESTRICT`.
- **Draft with a past `scheduledAt`:** allowed. It is only checked at schedule time (AC-32).
- **Cancelled campaigns:** kept forever, and cannot be deleted. This is intended for history.
- **Large input:** bounded by the field limits and Fastify's 1 MiB body limit.
- **Worker crash:** not applicable. No workers in 001.

## 11. Open questions
None.

## 12. Changelog
- 2026-10-15: created
- 2026-10-15: review fixes. Added the `outbox` table, `If-Match`/`ETag` versioning, replay header, error precedence, idempotency transaction design, cursor precision, field and list limits, `Clock` port, row-lock concurrency, and split ACs. Status → reviewed.
