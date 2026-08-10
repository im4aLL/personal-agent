# 22 - personal-agent | Frontend - Context usage indicator in the message box

**What to build:** A `ContextUsageIndicator` in `message-input.tsx`'s footer row showing current context usage vs. the model's context window (e.g. "12.4k / 250k"), updating live while typing and while a response streams.

**Blocked by:** #21 - Context window table and token estimator.

**Status:** Done

## Tasks

### `message-input.tsx`

- [x] Add `messages` to the existing `useChat()` destructure (currently only pulls `sendMessage, stop, isGenerating, canSend, isOffline`)
- [x] New `ContextUsageIndicator` component computing "current" = system prompt + summary (none exists until #23, treat as empty) + all messages + pending input text - exactly what the next request would send
- [x] Render in the footer row, right-aligned near the "AI can make mistakes" disclaimer
- [x] Color states: default / amber >= 70% / red >= 90%; optionally a thin progress bar

### Verify

- [x] Open a long conversation, watch the number
- [x] Type in the box, watch it climb
- [x] Send a message and watch the number keep updating while the response streams in, rather than freezing
