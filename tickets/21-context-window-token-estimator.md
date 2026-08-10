# 21 - personal-agent | Backend - Context window table and token estimator

**What to build:** New `src/lib/context.ts` module with a static provider/model context-window table and a per-message-memoized token estimator. Pure logic, no UI wiring yet.

**Blocked by:** None - can start immediately.

**Status:** Done

## Tasks

### `src/lib/context.ts`

- [x] `getContextWindow(baseUrl, modelId)`: static table keyed by provider base URL + model (OpenAI, DeepSeek, Gemini, Opencode Go, Ollama / LM Studio), fallback 128k for unknown models (`/v1/models` never returns context size). Matched on `baseUrl` rather than `providerId`, since `providerId` is derived from a user-editable label and isn't a stable provider signal.
- [x] `estimateTokens(messages)`: characters / 4 heuristic over `message.content`
- [x] Add a flat ~1000-token estimate per image attachment; explicitly exclude `attachment.data` (base64 image payload, embedded by `buildUserContent` in `use-chat.ts`) from the char-count heuristic so it isn't miscounted as text. Only attachments in `IMAGE_MIME_TYPES` (the same set `buildUserContent` sends) count as images.
- [x] Memoize per message, keyed by `(id, content.length)` - not `id` alone, since a streaming assistant message keeps the same id while `appendMessageContent` grows its content, and an id-only key would freeze its count at the first (near-empty) value. Bounded to 2000 entries to avoid unbounded growth over a long session.
- [x] `shouldCompact(tokens, window)`: `tokens > 0.7 * window`

### Verify

- [x] Log `estimateTokens(conversation.messages)` in DEV (skipped while a message is mid-stream to avoid flooding the console)
- [ ] Sanity-check against a provider's actual `usage` once usage logging is added (separate small task, not blocking)
