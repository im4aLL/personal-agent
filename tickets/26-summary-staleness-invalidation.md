# 26 - personal-agent | Backend - Summary staleness invalidation

**What to build:** Editing or regenerating a message at or before `summarizedUpToId` clears the persisted summary, so the next send re-compacts instead of sending a summary that no longer matches the messages it covers.

**Blocked by:** #25 - Manual compact button.

**Status:** Not started

## Tasks

### Store (`src/store/chat.ts`)

- [ ] In `editMessage`: if the edited message's index in `conversation.messages` is at or before the index of `summarizedUpToId`, clear `summary` and `summarizedUpToId`
- [ ] In `regenerate`: apply the same check against the message being regenerated
- [ ] Edits or regenerations strictly after `summarizedUpToId` (in the raw tail) leave the summary untouched, since the tail is always sent raw
- [ ] Persist the cleared summary fields via `saveConversation`

### Verify

- [ ] Edit a message inside the summarized region, send, confirm re-summarization happens (DEV log shows a fresh summarization call)
- [ ] Edit a message in the raw tail, send, confirm no re-summarization happens and the existing summary is reused
