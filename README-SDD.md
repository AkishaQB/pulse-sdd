# Spec-driven development kit for Pulse

Drop these files into the root of the Pulse repo.

```
CLAUDE.md                          project memory (kept short on purpose)
.claude/settings.json              permissions + auto-format hook
.claude/rules/api.md               backend rules, load only for apps/api/** and apps/worker/**
.claude/rules/web.md               SolidJS 2 rules, load only for apps/web/**
.claude/skills/spec-new/           /spec-new <NNN-name>   interview → spec.md
.claude/skills/spec-plan/          /spec-plan <NNN-name>  spec → plan.md + tasks.md
.claude/skills/implement-task/     /implement-task <NNN-name> <T#>  one task, tests first
.claude/agents/spec-reviewer.md    read-only reviewer subagent
specs/000-product.md               vision, glossary, spec index
specs/_template/                   spec.md, plan.md, tasks.md
```

## The loop

1. `/spec-new 003-coupon-redeem` — answer the interview questions.
2. "Use the spec-reviewer subagent on specs/003-coupon-redeem/spec.md" — fix the blocking items.
3. `/spec-plan 003-coupon-redeem` — approve the plan, get tasks.md.
4. `/clear`, then `/implement-task 003-coupon-redeem T1`. Repeat per task.
5. After each task, run `/usage` and write the number into the task's `Tokens:` line.

## Token habits built into this kit

- CLAUDE.md is short; procedures live in skills, which load only when invoked.
- Path-scoped rules mean web rules never load during backend work and vice versa.
- Skills are user-invoked only (`disable-model-invocation: true`), so their text doesn't sit in every session.
- The reviewer runs as a subagent on a cheaper model with read-only tools.
- `settings.json` blocks reads of node_modules, build output and lockfiles.
- Formatting runs in a hook, so no model tokens are spent on it.
- One task per session + `/clear` keeps context small and cache-friendly. Avoid switching model/effort or adding MCP servers mid-task.

## Requirements / notes

- The format hook needs `jq` and Prettier installed in the repo.
- Check field names against the current Claude Code docs if something doesn't load: skills, subagents, rules and hooks pages at https://code.claude.com/docs.
- `rules/web.md` reflects Solid 2.0 RC; update it as the API settles.
