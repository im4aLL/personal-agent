# 11 - personal-agent | Frontend - Hardening and polish

**What to build:** Provider form validation (URL scheme, non-empty key, duplicate labels), Turso validation, and message length limits. Unified error toasts and per-message retry. Masked API keys in all UI; no key logging. Credential-loss recovery: settings export of provider labels and base URLs (without keys) as a JSON file. Cached model lists, virtualized message list for long conversations, debounced search. Accessibility: Enter to send / Shift+Enter newline / Esc to stop, focus management in dialogs and edit mode, aria labels on icon-only buttons, theme contrast checks. Stream-drop retry with backoff. README and provider setup guide (opencode-go, OpenAI, Ollama, LM Studio, DeepSeek).

**Blocked by:** #9 - Turso remote-only persistence and history search, #10 - Thinking and reasoning content

**Status:** Ready For Dev

- [ ] Validation: provider form (URL scheme, non-empty key, duplicate labels), Turso URL/token checks, message length limits
- [ ] Errors: unified error toasts, per-message retry, proxy failure messaging, offline detection for Turso and providers
- [ ] Security: masked API keys in all UI, no key logging, review CSP and tighten
- [ ] Credential-loss recovery: settings export of provider labels and base URLs (without keys) as a JSON file
- [ ] Performance: cached model lists, virtualized message list for long conversations, debounced search
- [ ] Accessibility: Enter to send / Shift+Enter newline / Esc to stop, focus management in dialogs and edit mode, aria labels on icon-only buttons, theme contrast checks
- [ ] Resilience: stream-drop retry with backoff, behavior on restart mid-stream
- [ ] Logging and docs: dev logging of provider calls without keys; README and provider setup guide (opencode-go, OpenAI, Ollama, LM Studio, DeepSeek)
- [ ] Verify: `npm run tauri build` succeeds
