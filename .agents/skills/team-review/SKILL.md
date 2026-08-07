---
name: team-review
description: Run a parallel specialist team review of a feature, PR, design, or code changes.
disable-model-invocation: true
---

# Team Review

## Purpose

Run all four specialist agents simultaneously — architect, senior-backend, senior-frontend, and senior-qa — and synthesize their findings into a single report.

## When to Use

Use when the user asks for a "team review", "full review", or wants multiple specialist perspectives on a change, feature, or design.

## Process

1. Identify the scope from the user's request: a diff, a file path, a feature description, or a set of changed files.
2. If scope is not clear, run `git diff --stat` and `git status` to establish what has changed.
3. Fan out to all four agents **in parallel** using the `subagent` tool with a `tasks` array and `agentScope: "both"`:
   - **architect** — architectural implications: boundaries, contracts, data flow, trade-offs
   - **senior-backend** — backend implementation: API, data model, auth, error handling, performance
   - **senior-frontend** — frontend implementation: components, state, accessibility, edge states, performance
   - **senior-qa** — quality and coverage: edge cases, regression risks, acceptance criteria gaps
   - Give each agent the same context: the scope of the change, relevant file paths, and the goal.
4. Collect all four responses.
5. Synthesize into a single structured report:

```markdown
# Team Review

## Architect

<findings>

## Senior Backend

<findings>

## Senior Frontend

<findings>

## QA

<findings>

## Cross-cutting Concerns

<issues flagged by more than one agent, or that fall between roles>

## Verdict

**Ship / Ship with fixes / Hold**
<brief rationale and the highest-priority items to address before merging>
```

## Guardrails

- Do not skip agents because the change looks "frontend-only" or "backend-only" — the user asked for a full team review.
- Do not invent findings. If an agent found nothing material, say so explicitly.
- The verdict is a synthesis, not a majority vote — one blocking issue from any agent is enough to hold.
