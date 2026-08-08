# 19 - personal-agent | Frontend - Unify pinned section rendering

**What to build:** The pinned section in the sidebar uses the same `renderConversationItem` function as unpinned conversations, eliminating the duplicated editing and display JSX.
The function accepts an optional `icon` prop (default `MessageSquareIcon`, pinned section passes `PinIcon`).

**Blocked by:** None - can start immediately.

**Status:** Ready For Dev

## Tasks

- [ ] Extend `renderConversationItem` to accept an optional `icon` prop defaulting to `MessageSquareIcon`
- [ ] Replace the pinned section's inline JSX with `renderConversationItem(conversation, { icon: PinIcon })`
- [ ] Verify pinned conversations still show the pin icon and all hover actions (rename, delete) work as before
- [ ] Verify unpinned conversations still show the message-square icon
