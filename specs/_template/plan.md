# NNN – Plan

Written in plan mode from `spec.md`. No code here — only decisions.

## Approach
2–5 sentences: the overall shape of the solution.

## Files to add / change
| File | Change | Why (AC-ref) |
|---|---|---|
| `apps/api/src/modules/…` | new | AC-1, AC-2 |

## Key decisions
- Decision — alternatives considered — why this one.

## Risks
- What could go wrong, and how a test will catch it.

## Test strategy
- Unit: which services, with which fakes.
- Integration: which flows need real Postgres/Redis.
- Load/concurrency (if any): tool and pass threshold.
