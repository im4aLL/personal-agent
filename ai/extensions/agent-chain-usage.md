# Agent Chain Extension

## What is it?

**Agent Chain** is a sequential pipeline orchestrator. When you run it, the primary Pi agent loses all codebase tools — it can *only* trigger pipelines via a `run_chain` tool. Each pipeline is a chain of specialist sub-agents, where the output of one step becomes the input for the next. Each agent runs as a separate `pi` process with its own isolated context window and persistent session file, so agents remember their work across invocations within a session.

Agents are defined as `.md` files (with YAML frontmatter) in any of:
- `agents/`
- `.claude/agents/`
- `.pi/agents/`

Chains are sequences of agent steps defined in `.pi/agents/agent-chain.yaml`.

---

## How to use it

**1. Launch pi with the extension:**
```bash
pi -e ai/extensions/agent-chain.ts
```

**2. Define your agents** — each is a `.md` file, e.g. `.pi/agents/planner.md`:
```markdown
---
name: planner
description: Analyses a task and produces a detailed implementation plan
tools: read,grep,find,ls
---
You are a technical planner. Your job is to analyse a request and produce
a clear, step-by-step implementation plan...
```

**3. Define your chains** in `.pi/agents/agent-chain.yaml`:
```yaml
feature:
  description: "Plan → Build → Review pipeline for new features"
  steps:
    - agent: planner
      prompt: "Analyse this feature request and produce an implementation plan: $INPUT"
    - agent: builder
      prompt: "Implement the following plan: $INPUT\n\nOriginal request: $ORIGINAL"
    - agent: reviewer
      prompt: "Review the changes just made. Original request: $ORIGINAL\n\nPlan and build output:\n$INPUT"
```

**Template variables:**

| Variable | Value |
|----------|-------|
| `$INPUT` | Output from the previous step (or the user's original prompt for step 1) |
| `$ORIGINAL` | The user's original prompt, always |

**4. On startup** it auto-selects the first chain. Switch with `/chain`.

**Slash commands:**

| Command | What it does |
|---------|-------------|
| `/chain` | Pick a different chain from a select dialog |
| `/chain-list` | List all chains and their steps |

**5. Just chat** — the orchestrator LLM picks up your request and calls `run_chain` automatically. Each step runs in sequence, and the final step's output is returned to you.

---

## When should you use it?

Use it when you have a **repeatable, opinionated workflow** that benefits from strict role separation and a defined execution order. Specifically:

- **Plan → Build → Review** — a planner maps out the work, a builder executes it, a reviewer checks the result, each with its own context window
- **Research → Implement** — one agent investigates the codebase or problem space, the next writes code based on those findings
- **Transform pipelines** — tasks where the output of each stage is the natural input for the next (e.g. spec → scaffold → tests)
- **Repeatable processes** — if you run the same multi-step workflow regularly, encode it as a chain so it's consistent every time
- **Long-running projects** — agents persist sessions, so they accumulate domain knowledge across multiple prompts in a session

**Don't use it for ad-hoc or parallel work** — chains are sequential and opinionated. If you need agents to work simultaneously or you want the dispatcher to decide task assignment on the fly, use Agent Team instead. Use Agent Chain when the *order* of operations matters and the steps are well-defined upfront.
