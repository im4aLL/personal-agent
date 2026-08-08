# 20 - personal-agent | Frontend - Download model-provided files

**What to build:** Allow users to download content from model responses as files. This includes downloading code blocks as source files, downloading full assistant messages as `.md` files, and downloading images referenced in model output.

**Blocked by:** None - can start immediately.

**Status:** Done

## Tasks

- [x] Create shared `downloadFile` utility in `src/lib/download.ts` (Blob + createObjectURL + anchor click)
- [ ] ~~Add Download button to code blocks in `src/components/chat/markdown.tsx`~~ - Rejected; code block copy is sufficient.
- [x] Add "Download as .md" button to assistant message action row in `src/components/chat/message-bubble.tsx`
- [x] Add image download support: uses `data:` URL parsing for inline images and Tauri `proxy_bytes` Rust command (bypasses CORS) for remote images
- [x] Add `proxy_bytes` Rust command (`src-tauri/src/proxy.rs`) that fetches binary content and returns base64-encoded bytes with content-type
- [x] Intercept all markdown links via custom `a` component: file-like URLs (.pdf, .zip, etc.) download via proxy; other external URLs open in system browser via `@tauri-apps/plugin-opener` to prevent webview navigation lock-in
- [x] Add conversation-level export (Markdown) as a stretch goal

## Considerations

- Filename sanitization: strip path separators and special characters from auto-generated names
- Large content: add a size check and toast warning if content exceeds 50 MB (the Blob API handles typical chat messages fine but could fail on very large content)
- Remote URLs: Tauri `proxy_bytes` Rust command fetches binary content server-side (no CORS), returns base64, JS decodes to Blob and triggers download
- Webview safety: all markdown links intercepted; file URLs download via proxy, other URLs open in system browser (prevents webview getting stuck on PDFs)
