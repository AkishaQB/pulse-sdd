---
name: spec-explain
description: Explain a Pulse spec or a single task from it in plain language, with context needed to start work. Use when the user runs /spec-explain.
argument-hint: "<NNN-feature-name> [task-id, e.g. T7]"
disable-model-invocation: true
---

# Explain spec: $ARGUMENTS

Do not write or change any code. Read only what is needed.

## When a task ID is given (e.g. `/spec-explain 001-campaign-crud T7`)

1. Read `specs/<spec>/spec.md` (§1–§3 and only the ACs the task covers) and the named task entry in `specs/<spec>/tasks.md`.
2. Read `specs/<spec>/plan.md` — only the rows for the files this task touches.
3. For each file the task adds or changes: if it already exists, read its public interface only (exported types and function signatures, not bodies). If it does not exist, skip.
4. Check the Notes / learnings section of `tasks.md` for decisions that affect this task.
5. Reply with the following sections, in plain prose — no bullet-point dumps of the spec:

   **What this task is for** — one paragraph: the user story behind the ACs, not a restatement of them.

   **Acceptance criteria** — the AC IDs this task covers, each with a one-sentence plain-English gloss. Flag any AC that has a concurrency or atomicity requirement.

   **What already exists** — the interfaces, types, fakes or helpers this task may call, with file paths. One line each.

   **What to build** — the files and their roles, in the order they should be written. One line each.

   **Watch-outs** — at most three. Only things that are non-obvious from the spec text: a constraint that looks soft but is hard, a cross-task dependency, or a test-setup detail from the Notes.

   **Starting point** — one sentence: the first file to open and why.

Keep the reply under 40 lines. Do not summarise sections of the spec the task does not touch.

---

## When no task ID is given (e.g. `/spec-explain 001-campaign-crud`)

1. Read `specs/<spec>/spec.md` in full.
2. Read `specs/<spec>/tasks.md` to see which tasks are done and which remain.
3. Reply with the following sections:

   **Problem and goal** — two sentences max.

   **What's in scope / out of scope** — three bullets each, drawn from §2 and §3.

   **Status transitions** — reproduce the diagram from §5 verbatim (or describe it if none).

   **Key design decisions** — at most five, drawn from §6–§10: things a reader would not guess from the API alone (e.g. row-lock strategy, idempotency transaction, cursor encoding).

   **Acceptance criteria index** — group the ACs by subsystem (Create, Read, List, …). For each group, one sentence covering what the group tests. Do not list every AC individually.

   **Task progress** — a two-column table: task ID + title | done / pending.

   **Where to start** — the lowest pending task ID and one sentence on what it requires.

Keep the reply under 60 lines.
