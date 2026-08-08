# 10 - personal-agent | Frontend - Thinking and reasoning content

**What to build:** Reasoning text from capable models streams into the collapsible thinking block and is excluded from main message content. Capture via the Vercel AI SDK `fullStream` reasoning parts. Reasoning stored in `message.reasoning` during streaming and rendered via the existing thinking block from Phase 1. Manually verified: reasoning extraction.

**Blocked by:** #6 - First real chat flow with send, stream, and stop

**Status:** Done

- [x] Capture reasoning from SDK `fullStream` reasoning parts
- [x] Store reasoning into `message.reasoning` during streaming
- [x] Render reasoning via the existing collapsible thinking-block component
- [x] Ensure reasoning text is excluded from main message content
- [x] Verify: chat with a reasoning-capable model through a compatible endpoint
- [x] Verify: thinking streams live into the collapsible section, appears only there
- [x] Verify: reasoning persists with the message across reloads (once persistence is wired)
