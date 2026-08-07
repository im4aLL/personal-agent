# 10 - personal-agent | Frontend - Thinking and reasoning content

**What to build:** Reasoning text from capable models streams into the collapsible thinking block and is excluded from main message content. Capture via manual SSE `delta.reasoning_content` parsing in the custom `streamText` implementation. Reasoning stored in `message.reasoning` during streaming and rendered via the existing thinking block from Phase 1. Unit tests pass for reasoning extraction.

**Blocked by:** #6 - First real chat flow with send, stream, and stop

**Status:** Ready For Dev

- [ ] Parse `delta.reasoning_content` from SSE chunks in the custom `streamText` implementation
- [ ] Store reasoning into `message.reasoning` during streaming
- [ ] Render reasoning via the existing collapsible thinking-block component
- [ ] Ensure reasoning text is excluded from main message content
- [ ] Verify: chat with a reasoning-capable model through a compatible endpoint
- [ ] Verify: thinking streams live into the collapsible section, appears only there
- [ ] Verify: reasoning persists with the message across reloads (once persistence is wired)
