# coms — Peer-to-peer messaging between Pi agents

`coms` is a Pi extension that lets multiple agent instances on the same machine discover each other, exchange prompts, and share responses — all through local Unix sockets (or named pipes on Windows).

## Quick start

```bash
# Terminal 1 — launch a named agent
pi -e ai/extensions/coms.ts --cname alice --purpose "research assistant"

# Terminal 2 — launch a second agent in the same project
pi -e ai/extensions/coms.ts --cname bob --purpose "code reviewer"
```

Once running, each agent can use the `coms_list`, `coms_send`, `coms_get`, and `coms_await` tools to communicate.

---

## CLI flags

These flags are registered by the extension and accepted alongside the normal `pi` flags.

| Flag | Type | Default | Description |
|---|---|---|---|
| `--cname` | string | `agent-<ULID suffix>` | Agent name for this session. Distinct from pi's own `--name`. |
| `--purpose` | string | *(frontmatter description)* | Short description of what this agent does. |
| `--project` | string | `"default"` | Namespace used for peer discovery. Agents only see peers in the same project. |
| `--color` | string | *(palette fallback)* | Hex color `#RRGGBB` shown in the pool widget. |
| `--explicit` | boolean | `false` | Hide this agent from auto-discovery; only reachable by exact name. |

### Name resolution

If the desired `--cname` is already taken by a live agent in the same project, coms automatically appends a counter (`alice2`, `alice3`, …) and logs a `name_collision` event.

### Identity from frontmatter

If you use a system-prompt `.md` file (via `--system-prompt` or `--append-system-prompt`), coms reads its YAML frontmatter for `name`, `description`, and `color` — CLI flags take precedence over frontmatter values.

```markdown
---
name: alice
description: research assistant
color: "#36F9F6"
---
You are a research assistant...
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PI_COMS_DIR` | `~/.pi/coms` | Root directory for registry files and sockets. |
| `PI_COMS_MAX_HOPS` | `5` | Maximum number of agent-to-agent hops before a prompt is rejected. |
| `PI_COMS_TIMEOUT_MS` | `1800000` (30 min) | Default timeout for `coms_await` and pending reply entries. |
| `PI_COMS_PING_INTERVAL_MS` | `10000` | How often the pool widget pings peers for live status. |

---

## Tools

### `coms_list`

List peer agents discoverable in the current (or specified) project. Pings each peer for live context-window usage.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `project` | string | No | Project to scan, or `"*"` for all projects. Defaults to caller's project. |
| `include_explicit` | boolean | No | Include agents launched with `--explicit`. Default `false`. |

**Returns** — agent count + a line per peer: `● alice (claude-3-5-sonnet) 42% — research assistant`

**Example**
```
coms_list({ project: "default" })
coms_list({ project: "*", include_explicit: true })
```

---

### `coms_send`

Send a prompt to a named peer. Returns **immediately** once the receiver acknowledges receipt — the agent hasn't replied yet. Use `coms_get` or `coms_await` to retrieve the response.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `target` | string | Yes | Peer name (scoped to your project) or `session_id` (global). |
| `prompt` | string | Yes | The prompt to deliver to the peer agent. |
| `conversation_id` | string | No | Optional conversation identifier. |
| `response_schema` | object | No | JSON Schema describing the expected response shape. If set, the receiver's reply is parsed as JSON. |

**Returns** — `msg_id`, target name, and hop count.

**Example**
```
coms_send({
  target: "bob",
  prompt: "Review this function for edge cases: ...",
})
```

> **Hop counting** — When agent A sends to B, and B's handler sends to C, each forward increments `hops`. Messages are rejected once `hops >= PI_COMS_MAX_HOPS` (default 5).

---

### `coms_get`

Non-blocking poll for a reply. Returns immediately with status `pending`, `complete`, or `error`.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `msg_id` | string | Yes | The `msg_id` returned by `coms_send`. |

**Returns**

| Status | Meaning |
|---|---|
| `pending` | Peer hasn't replied yet. |
| `complete` | Reply available in `response` field. |
| `error` | Delivery failed or timed out; see `error` field. |

**Example**
```
coms_get({ msg_id: "01HZ..." })
```

---

### `coms_await`

Blocking wait for a reply. Suspends until the peer responds or the timeout fires.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `msg_id` | string | Yes | The `msg_id` returned by `coms_send`. |
| `timeout_ms` | number | No | Override the default timeout (ms). |

**Returns** — the peer's response text (or parsed JSON if `response_schema` was provided), or an error string on timeout.

**Example**
```
// Send then block until reply
const { msg_id } = await coms_send({ target: "alice", prompt: "Summarise this doc: ..." })
const reply      = await coms_await({ msg_id, timeout_ms: 60000 })
```

---

## Typical workflow

```
Agent A                              Agent B
───────                              ───────
coms_list()          →  discover alice, bob
coms_send(bob, "…")  →  bob receives prompt as a follow-up message
                         bob's next turn generates a response
                     ←  response automatically sent back to A
coms_await(msg_id)   ←  A receives bob's reply
```

The response is captured automatically at the end of each agent turn (`agent_end` hook) and dispatched back to the sender — no extra tooling needed on the receiver side.

---

## Pool widget

When the TUI is active, coms renders a live widget **below the editor** showing all peers in the current project:

```
┏━ coms ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ alice ━┓
 ● bob          sonnet-3-5      [######---------]  40%  —  code reviewer
 ● carol        gpt-4o          [###############] 100%  —  test runner
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

- **●** (colored) — peer is live and responding to pings  
- **●** (dim) — peer is in the registry but hasn't been pinged yet  
- **✗** — peer has been unreachable for several consecutive ping cycles  

The widget refreshes every `PI_COMS_PING_INTERVAL_MS` (default 10 s).

---

## `/coms` slash command

Type `/coms` in the input bar to force-refresh the pool widget immediately.

| Variant | Effect |
|---|---|
| `/coms` | Refresh pool |
| `/coms --all` | Toggle visibility of `--explicit` agents |
| `/coms --project <name>` | Switch the widget to display a different project |

---

## Registry

Each agent writes a JSON file at startup:

```
~/.pi/coms/projects/<project>/agents/<name>.json
```

The file is refreshed every 30 s by a heartbeat timer with live `context_used_pct`, `queue_depth`, and `heartbeat_at` fields. It is removed automatically on clean shutdown. Dead entries (where the PID no longer exists) are pruned on every registry read.

Socket files live at:

```
~/.pi/coms/sockets/<session_id>.sock   # POSIX
\\.\pipe\pi-coms-<session_id>          # Windows
```

---

## Structured responses

Pass `response_schema` to `coms_send` to request a typed JSON reply:

```
coms_send({
  target: "data-agent",
  prompt: "Return the top 3 items from the queue",
  response_schema: {
    type: "object",
    properties: {
      items: { type: "array", items: { type: "string" } }
    },
    required: ["items"]
  }
})
```

The receiver's last assistant message is parsed as JSON. If parsing fails, the response envelope carries `error: "response not valid JSON"` instead.

---

## Audit log

All significant events are written to the Pi session log under the `coms-log` key:

| Event | Fired when |
|---|---|
| `boot` | Session starts and identity is registered |
| `name_collision` | Desired name was taken; a suffix was appended |
| `inbound_prompt` | A prompt envelope was received and queued |
| `outbound_prompt` | A prompt envelope was sent via `coms_send` |
| `outbound_response` | Response dispatched back to sender after `agent_end` |
| `outbound_response_failed` | Response delivery failed |
| `orphan_response` | Response received for an unknown `msg_id` |
| `self_heal` | Registry file was missing and was re-created by the heartbeat |
| `shutdown` | Clean shutdown completed |
