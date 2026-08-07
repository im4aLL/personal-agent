# 5 — personal-agent | Backend - Real provider management and model discovery

**What to build:** Settings > Providers is fully real. Providers can be added, edited, deleted, and set as default, with label, base URL, and API key persisted in localStorage. open-code-go is available as a one-click preset alongside OpenAI, Ollama, LM Studio, and DeepSeek. The model selector fetches real models from `GET {baseUrl}/models` on provider selection, with loading and error states. When direct fetch fails (CORS), the Rust `proxy` command falls back to `reqwest` passthrough. Connection mode (direct vs proxy) is remembered per provider and shown in the UI. CSP is defined in `tauri.conf.json`. Unit tests pass for provider CRUD, validation, localStorage round-trip, and duplicate detection.

**Blocked by:** #3 — Chat area with message rendering, #4 — Message input, empty states, and settings page

**Status:** Ready For Dev

- [ ] `lib/config.ts`: localStorage CRUD for providers (`personal-agent:providers`) and selected provider/model
- [ ] `lib/providers.ts`: fetch models and test-connection call, direct fetch first, falling back to Rust `proxy` command on CORS/network failure
- [ ] Rust: `proxy` command in `proxy.rs` forwarding method, URL, headers, and body via `reqwest`, returning JSON over IPC; register in `lib.rs`; add capability permission
- [ ] Providers store: real actions replacing no-ops; model selector reads real models with loading state and error retry
- [ ] Provider form validation: URL scheme, non-empty key, duplicate label detection
- [ ] Quick-add presets for opencode-go, OpenAI, Ollama, LM Studio, DeepSeek
- [ ] Connection mode (direct vs proxy) remembered per provider, shown in UI
- [ ] Define CSP in `tauri.conf.json`: `connect-src` built from provider list, `script-src` and `style-src` for shadcn/highlight.js
- [ ] Verify: configure a real endpoint, see real models populate the selector, confirm providers persist across restart
- [ ] Verify: force direct path to fail (CORS-restricted endpoint) and observe proxy fallback with remembered mode
