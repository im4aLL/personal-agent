# 3 — personal-agent | Frontend - Chat area with message rendering

**What to build:** Selecting a mock conversation shows its messages in the chat area. Message bubbles render with role styling, markdown with syntax-highlighted code blocks, and copy-code buttons. Collapsible thinking blocks expand/collapse. Per-message action buttons (edit, copy, regenerate) are visible and show "Coming soon" toasts. Model selector dropdown shows mock providers and models. All visual interactions (collapse/expand, copy, dropdown selection) are live.

**Blocked by:** #2 — App shell, sidebar, and navigation

**Status:** Ready For Dev

- [ ] Build chat-area component: header (title, model selector), message list, empty state placeholder
- [ ] Build chat-header with conversation title and model selector dropdown (mock providers/models)
- [ ] Build message-list component rendering ordered messages
- [ ] Build message-bubble with role styling (user vs assistant), action buttons (edit, copy, regenerate)
- [ ] Build thinking-block as a collapsible reasoning section
- [ ] Build markdown component with react-markdown + rehype-highlight, copy-code button per code block
- [ ] Create Zustand chat store with real shape but mock data and no-op actions
- [ ] Selecting a conversation populates the chat area
- [ ] Copy-to-clipboard works on code blocks
- [ ] Collapse/expand on thinking blocks works
- [ ] Per-message action buttons show "Coming soon" toast
- [ ] Verify: walk through mock conversations, inspect bubbles, code highlighting, copy, thinking collapse
