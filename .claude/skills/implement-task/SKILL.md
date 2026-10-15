---
name: implement-task
description: Implement exactly one task from a Pulse spec's tasks.md, tests first. Use when the user runs /implement-task.
argument-hint: "<NNN-feature-name> <task-id, e.g. T2>"
disable-model-invocation: true
---

# Implement task: $ARGUMENTS

Scope is one task. Stay inside it.

1. Read `specs/<spec>/spec.md`, then only the named task in `specs/<spec>/tasks.md` and the matching part of `plan.md`.
2. Read only the files this task touches. If you need a broad search, use the Explore subagent.
3. Write or update tests first, named after the AC IDs this task covers (e.g. `it('AC-2: …')`). Run them and confirm they fail for the right reason.
4. Implement the smallest change that makes them pass. Follow `CLAUDE.md` and the path rules in `.claude/rules/`.
5. Run the task's own check, then `pnpm lint && pnpm typecheck && pnpm test`. Delegate long or noisy test output to a subagent and keep only the summary here.
6. If the code had to differ from the spec, update `spec.md` (and its changelog) in the same change and say why.
7. Tick the task in `tasks.md`. Leave the `Tokens:` line for the user to fill from `/usage`.
8. Reply with: what changed (files), check results, any spec changes, and the next task ID. Keep it under 10 lines.

Do not start the next task. The user will `/clear` and start a fresh session for it.
