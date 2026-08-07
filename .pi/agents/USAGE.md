# Using project agents

Pi agent definitions in this folder are the source of truth for all supported CLI adapters. They include:

- `planner.md`
- `reviewer.md`
- `builder.md`
- `documenter.md`
- `security.md`
- `scout.md`
- `browser.md`
- `plan-reviewer.md`
- `tester.md`
- `auditor.md`
- `triage.md`

### Team agents

- `architect.md` — system design, ADRs, trade-offs, and structural risk
- `senior-backend.md` — API design, data modeling, auth, and backend performance
- `senior-frontend.md` — component architecture, state management, accessibility, and frontend performance
- `senior-qa.md` — test coverage gaps, edge cases, regression risks, and acceptance criteria

Invoke them individually or together via the `team-review` skill, which fans all four out in parallel and synthesizes their findings.

Each agent file should define a `name` in YAML frontmatter:

```md
---
name: planner
description: Investigates the repository and creates implementation plans
tools: read, grep, find, ls
---

Agent instructions go here.
```

## Claude Code and OpenCode

Generate native project-level definitions for both tools after changing any Pi agent:

```bash
bun ai/scripts/sync-agents.ts
```

This writes `.claude/agents/*.md` and `.opencode/agents/*.md`, translating tool permissions while preserving each system prompt. OpenCode agents are invoked directly with `@agent-name`, so the script does not generate duplicate OpenCode slash commands. It also mirrors `.agents/skills/` into `.claude/skills/`, because Claude Code does not discover the shared skill directory directly. Check for drift without writing files:

```bash
bun ai/scripts/sync-agents.ts --check
```

Do not edit generated definitions or mirrored skills directly. Update `.pi/agents/*.md` or `.agents/skills/` and regenerate them.

## Activate an agent in chat

Ask for the agent by name:

```text
Use the planner agent to create an implementation plan for this feature.
```

```text
Run the reviewer agent on the current changes.
```

```text
Ask the security agent to inspect this code path for risks.
```

In OpenCode, invoke the generated subagent directly:

```text
@planner create an implementation plan for this feature
```

```text
@reviewer review the current changes
```

## Programmatic invocation

When invoking a project-local agent through the subagent tool, set `agentScope` to `project` or `both`:

```json
{
  "agent": "planner",
  "task": "Create a plan for implementing X",
  "agentScope": "project",
  "cwd": "/Users/hadi/repos/temp"
}
```

Use `both` when you want Pi to consider both global agents and project-local agents:

```json
{
  "agent": "planner",
  "task": "Create a plan for implementing X",
  "agentScope": "both"
}
```

## Reloading

If you add or edit agent files, run this in Pi:

```text
/reload
```

or restart the session.
