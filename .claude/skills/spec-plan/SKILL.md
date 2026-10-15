---
name: spec-plan
description: Turn a reviewed Pulse spec into plan.md and tasks.md. Use when the user runs /spec-plan.
argument-hint: "<NNN-feature-name>"
disable-model-invocation: true
---

# Plan spec: $ARGUMENTS

Work in read-only mode until step 4. Do not write application code.

1. Read `specs/$ARGUMENTS/spec.md`. If it has unresolved open questions, list them and stop.
2. Explore only the code this spec touches (use the Explore subagent for wide searches so file dumps stay out of this session).
3. Draft the plan using `specs/_template/plan.md`. Every file change must reference the AC IDs it serves; flag any AC with no planned change.
4. Show the plan to the user and wait for approval. Then write `specs/$ARGUMENTS/plan.md`.
5. Split the plan into `specs/$ARGUMENTS/tasks.md` using `specs/_template/tasks.md`:
   - Each task fits one session (roughly ≤ 5 files changed).
   - Each task has a concrete check command.
   - Order: migrations/types → tests for ACs → implementation → integration test.
6. Update the spec's status to `planned` in `specs/000-product.md`. Reply with the task list only.
