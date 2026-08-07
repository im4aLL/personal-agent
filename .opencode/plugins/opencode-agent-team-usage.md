# OpenCode Agent Team

## What it does

The project plugin at `.opencode/plugins/agent-team.ts` adds a dispatcher-only primary agent named `agent-team`. It can coordinate specialists from `.opencode/agents/`, but it cannot read, edit, search, or run repository commands itself.

Teams are defined independently for OpenCode in `.opencode/agents/teams.yaml`. The companion TUI plugin at `.opencode/plugins/agent-team-status/`, registered by `.opencode/tui.json`, provides the live agent grid and team controls.

## Start the dispatcher

From this repository, run:

```bash
opencode --agent agent-team
```

You can also start OpenCode normally and switch to `agent-team` with the configured agent-switch key, normally `Tab`.

Describe the overall task. The dispatcher chooses specialists from the active team, assigns focused tasks, reviews their results, and sends follow-up work when needed.

## Commands

The TUI plugin registers these commands:

| Command | What it does |
|---|---|
| `/agents-team` | Select the active team for the current parent session. |
| `/agents-list` | Show active specialists and their latest status. |
| `/agents-grid` | Select between one and six dashboard columns. |
| `/agents-toggle` | Show or hide the entire agent-team dashboard. |

Team selection is sent through the restricted `set_agent_team` tool. It is recorded in the parent conversation and recovered after restarting OpenCode.

Dashboard visibility defaults to shown. `/agents-toggle` stores the preference in the OpenCode TUI KV store, so it persists across restarts and applies to the dashboard across sessions rather than to a specific session or team.

## Configure teams

Edit `.opencode/agents/teams.yaml`:

```yaml
backend-team:
  - scout
  - builder
  - reviewer

frontend-team:
  - planner
  - builder
  - browser
```

Each member must match a Markdown agent filename in `.opencode/agents/`. Duplicate members, empty teams, unsupported YAML, and missing agents stop plugin startup with a specific configuration error.

The first configured team is the default for a new parent session.

After changing a plugin, dependency, agent, or team configuration, quit and restart OpenCode. These files are loaded only at startup.

## Dispatch behavior

The dispatcher has four orchestration tools:

| Tool | Purpose |
|---|---|
| `dispatch_agent` | Run one focused specialist task. |
| `dispatch_agents` | Run up to eight independent specialist tasks concurrently. |
| `set_agent_team` | Change the active team for this parent session. |
| `agent_team_status` | Report the active team and available teams. |

Only specialists in the active team can be dispatched. A parallel dispatch cannot invoke the same specialist twice, and a specialist cannot receive another task while it is already running under the same parent session.

Concurrent specialists share the same worktree. Use parallel dispatch for independent investigation, review, or non-overlapping changes; use sequential dispatch when one specialist depends on another's output or changes.

## Persistent sessions

For each parent session, the plugin creates one native OpenCode child session per specialist and reuses it on later dispatches. Child sessions and their context survive OpenCode restarts. The selected team is recovered from parent-session tool metadata.

Use the normal child-session keybindings to inspect specialist work:

| Action | Default binding |
|---|---|
| Enter first child session | `<Leader>+Down` |
| Cycle child sessions | `Right` / `Left` |
| Return to parent | `Up` |

Child agents cannot recursively invoke the team dispatcher tools.

Cancelling a parent dispatch aborts active child prompts. Workspace changes completed before cancellation are not reverted.

## Dashboard

The dashboard appears at the bottom of session views and shows every member of the active team. Each card reports:

- Idle, running, completed, or error state
- Current activity and elapsed time
- Run count for the current OpenCode process
- Latest input-context percentage when the model limit is available

The dashboard derives durable status from dispatch tool metadata. Elapsed time and current activity update while specialists run without displaying their prompts, tool arguments, or generated text.
