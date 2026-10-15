---
name: task-done
description: Code-review, commit and push after completing a Pulse spec task. Use when the user runs /task-done.
argument-hint: "<NNN-feature-name> <task-id, e.g. T7>"
disable-model-invocation: true
---

# Task done: $ARGUMENTS

Parse `$ARGUMENTS` into `<spec>` (e.g. `001-campaign-crud`) and `<task-id>` (e.g. `T7`).
If either is missing, stop and tell the user: `/task-done <NNN-feature-name> <task-id>`.

---

## Step 1 — Verify definition of done

Read the named task entry in `specs/<spec>/tasks.md`. Confirm:
- The task is ticked (`[x]`).
- The task's own check command is present.

If the task is not ticked, stop: "Tick the task in tasks.md before running /task-done."

Run the check sequence in order. Stop and report the first failure:

```
pnpm lint
pnpm typecheck
pnpm test
<task's own check from tasks.md>
```

All four must pass. If any fail, list the errors and stop. Do not proceed to the review.

---

## Step 2 — Code review

Run `git diff HEAD` (staged + unstaged) to get the full diff for this task.
If the diff is empty, stop: "Nothing staged or changed since last commit."

Invoke the `spec-reviewer` subagent with:
- The spec path: `specs/<spec>/spec.md`
- The diff from step 2

Wait for the subagent's findings. Categorise them:

- **Blocking** (spec violation, untested AC, broken invariant): list each one. Stop here and ask the user to fix before committing.
- **Should fix**: list each one. Ask the user: "Fix these before committing, or proceed anyway?" Wait for the answer. If the user says fix, apply the fixes and re-run step 1, then return here.
- **Questions / minor**: note them but do not block.

If there are no blocking findings and the user has confirmed any "should fix" items, continue.

---

## Step 3 — Commit

Read the task title from `specs/<spec>/tasks.md` (the text after `**T<n> –`).
Read the AC IDs the task covers (the `Covers:` line).

Build the commit message:

```
spec-<NNN>(T<n>): <task title>

Covers: <AC IDs from the task's Covers line>
```

Keep the subject line ≤ 72 characters. If it would exceed that, shorten the task title, not the spec reference.

End the commit message with:

```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Stage all changes with `git add -A`, then show the user:
- The file list (`git status --short`)
- The full commit message

Ask: "Commit with this message? (y / edit / abort)"

- **y**: create the commit.
- **edit**: let the user provide a replacement message, then commit.
- **abort**: stop without committing.

---

## Step 4 — Push

After a successful commit, show the target: `origin main` (or the current branch if not `main`).

Ask: "Push to origin? (y / n)"

- **y**: run `git push origin <branch>`. Report the push URL from the output.
- **n**: stop. Tell the user: "Committed locally. Run `git push` when ready."

---

## Step 5 — Done

Reply with (under 8 lines):
- Commit hash (short) and subject line.
- Push URL or "not pushed".
- The next pending task ID from `specs/<spec>/tasks.md`, or "All tasks done" if none remain.

Do not start the next task. The user will `/clear` and start a fresh session for it.
