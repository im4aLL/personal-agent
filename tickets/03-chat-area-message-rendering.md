# 3 - personal-agent | Frontend - Chat area with message rendering

**What to build:** Selecting a mock conversation shows its messages in the chat area. Message bubbles render with role styling, markdown with syntax-highlighted code blocks, and copy-code buttons. Collapsible thinking blocks expand/collapse. Per-message action buttons (edit, copy, regenerate) are visible and show "Coming soon" toasts. Model selector dropdown shows mock providers and models. All visual interactions (collapse/expand, copy, dropdown selection) are live.

**Blocked by:** #2 - App shell, sidebar, and navigation

**Status:** Done

- [x] Build chat-area component: header (title, model selector), message list, empty state placeholder
- [x] Build chat-header with conversation title and model selector dropdown (mock providers/models)
- [x] Build message-list component rendering ordered messages
- [x] Build message-bubble with role styling (user vs assistant), action buttons (edit, copy, regenerate)
- [x] Build thinking-block as a collapsible reasoning section
- [x] Build markdown component with react-markdown + rehype-highlight, copy-code button per code block
- [x] Create Zustand chat store with real shape but mock data and no-op actions
- [x] Selecting a conversation populates the chat area
- [x] Copy-to-clipboard works on code blocks
- [x] Collapse/expand on thinking blocks works
- [x] Per-message action buttons show "Coming soon" toast
- [x] Verify: walk through mock conversations, inspect bubbles, code highlighting, copy, thinking collapse
