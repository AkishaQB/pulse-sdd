# NNN – Feature name

**Status:** draft | reviewed | planned | in progress | done
**Phase:** (Pulse phase number)
**Related specs:** (links)

## 1. Problem
What's wrong or missing today, in 2–4 sentences. Who feels it?

## 2. Goal
One sentence: what is true when this ships?

## 3. Non-goals
What this spec deliberately does NOT cover (stops scope creep, saves tokens).
- 

## 4. Acceptance criteria
Each one must be testable. Tests are named after these IDs.

- **AC-1:** Given …, when …, then …
- **AC-2:** Given …, when …, then …
- **AC-3 (failure):** Given …, when …, then … (error code / behaviour)
- **AC-4 (concurrency/perf, if relevant):** Given …, when …, then …

## 5. API contract
| Method | Path | Request | Success | Errors |
|---|---|---|---|---|
| POST | /… | `{ … }` | 201 `{ … }` | 400, 409, … |

## 6. Data model
- Tables / columns added or changed:
- Constraints (unique, FK, check):
- Indexes and the query each one serves:

## 7. Events
| Event | Emitted when | Payload | Consumers |
|---|---|---|---|
| `SomethingHappened` | … | `{ id, … }` | stats, audit |

## 8. Jobs / queues (if any)
Queue name, trigger, retries/backoff, what goes to the DLQ.

## 9. Caching / Redis (if any)
Keys, TTLs, invalidation rule, atomic operations.

## 10. Edge cases & failure modes
- What if Redis is down?
- What if the same request arrives twice?
- What if the worker crashes mid-job?

## 11. Open questions
- [ ] …

## 12. Changelog
- YYYY-MM-DD: created
