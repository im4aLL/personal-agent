# 8 — personal-agent | Frontend - Conversation management and auto-titles

**What to build:** New chat, rename (inline), delete with confirmation dialog, and auto-titling from the first user message are all real. Date grouping in the sidebar reflects actual `updatedAt` values. If auto-titling fails, the conversation falls back to "New chat." Unit tests pass for date grouping logic, title fallback, and conversation CRUD reducers.

**Blocked by:** #6 — First real chat flow with send, stream, and stop

**Status:** Ready For Dev

- [ ] Chat store: conversation actions (new, rename, delete) wired for real, replacing Phase 1 toasts
- [ ] Delete confirmation dialog
- [ ] Inline rename editing on conversation items
- [ ] Auto-title via a short non-streaming `generateText` call using the conversation's provider/model, triggered after the first exchange completes
- [ ] Fallback to "New chat" when auto-title fails
- [ ] Date grouping in sidebar reflects real `updatedAt` values and updates after edits
- [ ] Verify: create, rename, and delete conversations
- [ ] Verify: auto-generated titles appear after first exchange
- [ ] Verify: date grouping and ordering update after edits
