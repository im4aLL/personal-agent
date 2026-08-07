# 6 - personal-agent | Backend - First real chat flow with send, stream, and stop

**What to build:** Typing a message and pressing Send produces a real streamed AI response rendered into a message bubble. A de-risking spike first verifies `proxyFetch` streaming through Tauri channels + Rust `reqwest` streaming, with `AbortController` wired end-to-end (webview abort cancels the Rust request). Conversations live in memory only (lost on restart). Stop button halts generation mid-stream. Failures show an error bubble with retry. Reasoning deltas from the stream are explicitly dropped (not concatenated into content) with a unit test verifying this. Input shows generating state (disables send, shows stop button, streaming indicator on active bubble). Unit tests pass for chat store reducers, reasoning-drop logic, and SSE parse helpers.

**Blocked by:** #5 - Real provider management and model discovery

**Status:** Ready For Dev

- [ ] De-risking spike: implement `proxyFetch(provider, url, init)` in `lib/ai.ts` returning a webview `Response` via Tauri channel + streamed chunks from Rust
- [ ] Rust side: `proxy_stream` command using `reqwest` streaming + Tauri channel to push chunks to webview
- [ ] Verify spike: stream a real `streamText` call against a CORS-restricted endpoint, including `AbortController`/`stop` (webview abort cancels Rust `reqwest` request)
- [ ] `lib/ai.ts`: per-request `createOpenAICompatible({ baseURL, apiKey, name })` + `streamText` using `proxyFetch` when provider is in proxy mode
- [ ] `hooks/use-chat.ts`: drives chat store; sends via conversation's provider, creates user message and assistant placeholder, pipes `textStream` deltas into store (dropping reasoning deltas), exposes `stop` via abort controller, handles completion and error statuses
- [ ] Wire `AbortController` end-to-end: webview abort -> Tauri channel drop -> Rust `reqwest` request cancelled
- [ ] Input states: generating disables send and shows stop; streaming indicator on active bubble; error toast plus error message state with retry
- [ ] Verify: chat with a real provider end to end, characters stream in
- [ ] Verify: stop mid-generation, confirm truncation and proper Rust-side abort
- [ ] Verify: kill the provider and confirm error path with retry
- [ ] Verify: switch providers and models and chat with each
- [ ] Verify: proxy streaming path with a CORS-restricted endpoint
