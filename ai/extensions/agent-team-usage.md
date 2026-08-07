# Agent Team Extension

## What is it?

**Agent Team** is a dispatcher-only orchestrator. When you run it, the primary Pi agent loses all codebase tools — it can *only* delegate work to specialist sub-agents via a `dispatch_agent` tool. Each specialist is a separate `pi` process with its own isolated context window and persistent session file, so agents remember their work across invocations within a session.

Agents are defined as `.md` files (with YAML frontmatter) in any of:
- `agents/`
- `.claude/agents/`
- `.pi/agents/`

Teams are groups of agents defined in `.pi/agents/teams.yaml`.

---

## How to use it

**1. Launch pi with the extension:**
```bash
pi -e ai/extensions/agent-team.ts
```

**2. Define your agents** — each is a `.md` file, e.g. `.pi/agents/scout.md`:
```markdown
---
name: scout
description: Explores the codebase, reads files, finds patterns
tools: read,grep,find,ls
---
You are a code explorer. Your job is to read and understand code...
```

**3. Optionally define teams** in `.pi/agents/teams.yaml`:
```yaml
backend-team:
  - scout
  - builder
  - reviewer

frontend-team:
  - designer
  - tester
```

**4. On startup** it auto-selects the first team. Switch with `/agents-team`.

**Slash commands:**

| Command | What it does |
|---------|-------------|
| `/agents-team` | Pick a different team from a select dialog |
| `/agents-list` | Show all agents, their status, session state, and run count |
| `/agents-grid <1-6>` | Change the dashboard column count |

**5. Just chat** — the dispatcher LLM breaks your request into sub-tasks and calls `dispatch_agent` automatically. You don't invoke agents directly.

---

## When should you use it?

Use it when a task is **too large or complex for a single context window**, or when you want **parallel specialist workflows**. Specifically:

- **Large refactors** — scout reads the codebase, builder makes changes, reviewer checks them, all without blowing one context window
- **Research + implement** — one agent investigates, another writes code based on the findings
- **Multi-step pipelines** — tasks where output of one agent naturally feeds the next
- **Long-running projects** — agents persist sessions, so they accumulate domain knowledge across multiple prompts in a session
- **Role separation** — you want a strict boundary between "reading/understanding" and "writing/changing" work

**Don't use it for simple, single-context tasks** — the dispatching overhead isn't worth it for a quick edit or a single-file question. Use it when you'd otherwise worry about context overflow or want true specialization.
