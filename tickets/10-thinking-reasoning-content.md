# 10 - personal-agent | Frontend - Thinking and reasoning content

**What to build:** Reasoning text from capable models streams into the collapsible thinking block and is excluded from main message content. Capture from `fullStream` reasoning parts (primary path) and manual SSE `delta.reasoning_content` (fallback). Reasoning stored in `message.reasoning` during streaming and rendered via the existing thinking block from Phase 1. Unit tests pass for reasoning extraction from both paths.

**Blocked by:** #6 - First real chat flow with send, stream, and stop

**Status:** Ready For Dev

- [ ] Capture reasoning from `fullStream` reasoning parts via the AI SDK (primary path)
- [ ] Manual SSE fallback: parse `delta.reasoning_content` for endpoints the SDK does not normalize
- [ ] Store reasoning into `message.reasoning` during streaming
- [ ] Render reasoning via the existing collapsible thinking-block component
- [ ] Ensure reasoning text is excluded from main message content
- [ ] Verify: chat with a reasoning-capable model through a compatible endpoint
- [ ] Verify: thinking streams live into the collapsible section, appears only there
- [ ] Verify: reasoning persists with the message across reloads (once persistence is wired)
