---
name: spec-new
description: Create a new feature spec for Pulse by interviewing the user first. Use when the user runs /spec-new or asks to start a new spec.
argument-hint: "<NNN-feature-name>"
disable-model-invocation: true
---

# Create a new spec: $ARGUMENTS

1. Read `specs/000-product.md` (glossary + spec index) and `specs/_template/spec.md`. Do not read application code yet.
2. Interview the user before writing anything. Ask in rounds of at most 4 short questions, using multiple choice where possible:
   - Round 1: problem, goal, who triggers it, what's out of scope.
   - Round 2: happy-path behaviour and the API shape.
   - Round 3: failure modes — duplicates, concurrency, Redis/Postgres down, worker crash, invalid input.
   - Round 4 (only if relevant): events, queues, caching, indexes.
   Stop asking when every section of the template can be filled without guessing.
3. Create `specs/$ARGUMENTS/spec.md` from the template. Every acceptance criterion must be testable and use Given/When/Then. Include at least one failure AC.
4. Put anything still unresolved under "Open questions" — never invent an answer.
5. Add the spec to the index in `specs/000-product.md` with status `draft`.
6. Reply with: the AC list (IDs + one line each) and the open questions. Nothing else. Suggest running the `spec-reviewer` subagent next.
