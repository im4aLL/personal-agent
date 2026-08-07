# 7 - personal-agent | Frontend - Regenerate and edit messages

**What to build:** Regenerate replaces the last assistant message with a fresh streamed response. Editing a user message opens an inline textarea; on save, the text is replaced, downstream messages are truncated, an "edited" marker appears, and the assistant re-streams from that point. Message action buttons (previously toasts) are wired to these real handlers. Unit tests pass for regenerate truncation logic, editMessage descendant removal, and editedAt marker.

**Blocked by:** #6 - First real chat flow with send, stream, and stop

**Status:** Ready For Dev

- [ ] Chat store: `regenerate` action (remove last assistant message, re-stream with unchanged context)
- [ ] Chat store: `editMessage` action (patch content, set `editedAt`, truncate descendants, re-stream from that point)
- [ ] Wire message action buttons (edit, regenerate) that were toasts in Phase 1 to these real handlers
- [ ] Inline textarea for editing user messages with save/cancel
- [ ] Edited marker visible on edited messages
- [ ] Verify: regenerate produces a different response
- [ ] Verify: edit changes the question and conversation re-answers from that point
- [ ] Verify: edited marker shows, downstream messages are removed
