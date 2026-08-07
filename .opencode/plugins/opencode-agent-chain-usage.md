# OpenCode Agent Chain

## What it does

The project plugin at `.opencode/plugins/agent-chain.ts` provides a deterministic `run_chain` tool for OpenCode. It reads OpenCode-specific workflows from `.opencode/agents/agent-chain.yaml`, then runs each step sequentially through the project agents in `.opencode/agents/`. The companion TUI plugin at `.opencode/plugins/agent-chain-status/`, registered by `.opencode/tui.json`, displays live progress.

The plugin also adds a project-only primary agent named `agent-chain`. That agent can only ask you to choose a workflow and call `run_chain`; it cannot read, edit, or run commands itself. The plugin does not change the default OpenCode agent and does not install anything in `~/.config/opencode`.

## Start the workflow

From this repository, either start OpenCode with the workflow agent:

```bash
opencode --agent agent-chain
```

Or start OpenCode normally and switch to `agent-chain` with the configured agent-switch key, normally `Tab`.

Name a configured chain and describe the task. The workflow agent calls `run_chain` with your selected chain and complete request.

```text
Use bug-fix to fix the checkout crash when a saved address has no postal code.
```

If you do not name a workflow, the agent asks you to choose from the configured chains. It does not recommend, infer, or select one for you.

No per-agent OpenCode slash commands are required. Direct `@planner`, `@builder`, and other subagent invocations remain available when a full chain is unnecessary.

## Configure chains

Chains are defined in `.opencode/agents/agent-chain.yaml` independently of Pi's workflows:

```yaml
plan-build-review:
  description: "Plan, implement, and review the standard development cycle"
  steps:
    - agent: planner
      prompt: "Plan the implementation for: $INPUT"
    - agent: builder
      model: openai/gpt-5.3-codex
      prompt: "Implement the following plan:\n\n$INPUT\n\nOriginal request:\n$ORIGINAL"
    - agent: reviewer
      prompt: "Review this implementation:\n\n$INPUT"
```

Each step supports:

| Field | Required | Meaning |
|---|---|---|
| `agent` | Yes | OpenCode subagent name from `.opencode/agents/` |
| `prompt` | Yes | Prompt template for the step |
| `model` | No | Per-step `provider/model` override |

Template variables:

| Variable | Value |
|---|---|
| `$INPUT` | Original task for step 1; previous step's text output thereafter |
| `$ORIGINAL` | Original task for every step |

If `model` is omitted, OpenCode uses the model configured for that subagent, or the current parent model when the subagent has no model override. The effective model is passed on every step so a prior override does not remain active when a child session is reused.

The parser intentionally accepts the constrained YAML shape shown above: top-level chain keys, `description`, `steps`, and step-level `agent`, `prompt`, and optional `model`. Use quoted strings with `\n` escapes for multiline prompts.

After changing a plugin, dependency, or chain configuration, quit and restart OpenCode. Plugins and generated workflow prompts are loaded only at startup.

## Execution behavior

- Steps execute strictly in their configured order.
- A failed, empty, or cancelled step stops the chain immediately.
- The tool validates all referenced agents before starting step 1.
- Only one chain may run in this worktree within the current OpenCode process at a time. Separate OpenCode processes are not coordinated.
- Child agents cannot recursively invoke `run_chain`.
- A persistent status line at the bottom of the TUI reports the active chain, step, agent, latest activity, and elapsed time. Activity updates identify tool execution and response generation without exposing prompts, tool arguments, or generated text.
- Previous-step output is JSON-encoded and marked as untrusted workflow context before it is passed to the next agent; the original request and agent system instructions remain authoritative.

OpenCode child sessions replace the Pi subprocess session directories. For each parent session, the plugin creates one persistent child session per agent and reuses it on later chain runs, including after OpenCode restarts. This matches the Pi extension's per-agent session continuity while making child work visible through OpenCode's native session navigation.

Use the normal child-session keybindings to inspect work:

| Action | Default binding |
|---|---|
| Enter first child session | `<Leader>+Down` |
| Cycle child sessions | `Right` / `Left` |
| Return to parent | `Up` |

Cancelling the parent tool aborts the currently active child session. Completed earlier steps remain in their child sessions and any workspace changes already made are not reverted.

## Available chains

The current `.opencode/agents/agent-chain.yaml` defines:

- `plan-build-review`
- `plan-build`
- `scout-flow`
- `plan-review-plan`
- `full-review`
- `ticket-pipeline`
- `bug-fix`

The `agent-chain` workflow prompt and `run_chain` tool description are generated from this file whenever OpenCode starts.
