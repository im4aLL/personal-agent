# 22 - personal-agent | Frontend - Context usage indicator in the message box

**What to build:** A `ContextUsageIndicator` in `message-input.tsx`'s footer row showing current context usage vs. the model's context window (e.g. "12.4k / 250k"), updating live while typing and while a response streams.

**Blocked by:** #21 - Context window table and token estimator.

**Status:** Not started

## Tasks

### `message-input.tsx`

- [ ] Add `messages` to the existing `useChat()` destructure (currently only pulls `sendMessage, stop, isGenerating, canSend, isOffline`)
- [ ] New `ContextUsageIndicator` component computing "current" = system prompt + summary (none exists until #23, treat as empty) + all messages + pending input text - exactly what the next request would send
- [ ] Render in the footer row, right-aligned near the "AI can make mistakes" disclaimer
- [ ] Color states: default / amber >= 70% / red >= 90%; optionally a thin progress bar

### Verify

- [ ] Open a long conversation, watch the number
- [ ] Type in the box, watch it climb
- [ ] Send a message and watch the number keep updating while the response streams in, rather than freezing
