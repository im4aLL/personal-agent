# Changelog

## 1.8.0

### Features
- Add opt-in agent memory: the agent can remember durable facts (name, preferences, decisions) and recall them across conversations via `remember` and `recall` tools, with a Preferences settings section (master switch off by default, short-term/long-term toggles, token-capped recall, clear memories) and a schema v8 `memories` table (`5cd71d0`)

## 1.7.0

### Features
- Add create-pdf agent tool: agents can generate a formatted PDF (title plus light-markdown body via `lopdf`) and save it through a save dialog, with a "PDF creation" toggle in Web Search settings (`7473304`)
- Switch PDF text extraction from `pdf-extract` to `pdf-inspector`, returning extracted markdown with clearer errors for password-protected and scanned PDFs (`0b54800`)

### Fixes
- Make reasoning transient: stop persisting reasoning to the messages table (schema v7 drops the `reasoning` column) and serialize concurrent migration runs (`7ec41c0`)

## 1.6.0

### Fixes
- Fix Opencode Go requests failing with HTTP 400 MissingSessionID: send a stable `x-opencode-session` per conversation and a `personal-agent` User-Agent, routing Go traffic through the Rust proxy (`d2a40cd`)
- Send the `personal-agent` User-Agent on every provider request, sourced dynamically from the app version (`d2a40cd`)

## 1.5.0

### Features
- Add show/hide message icons toggle to appearance settings (`d7cbc20`)
- Fix copy-to-clipboard for code blocks and fix code block overflow (`fc2e1e3`)
- Fix chat header truncation and shrink button group (`612bf7d`)

### Fixes
- Fix Windows 1.4.0 build (`db28afd`)

## 1.4.0

### Features
- Add PDF attachment text extraction so PDF attachments are sent to models as extracted text (`35280dd`)
- Give the chat area more room and adjust the native menu; fix provider list sync (`00a8852`)

## 1.3.0

### Features
- Add context token estimator with a live context-usage indicator in the message input footer (`adcad13`, `14f67fa`)
- Persist per-conversation summaries with a `summarized_up_to_id` cutoff via a new schema migration (`974b43a`)
- Implement automatic context compaction: summarize older turns once a conversation approaches its model's context window, keeping a raw tail unsummarized (`9f0b590`)
- Add a manual "Compact" button and resolve real context windows from provider model metadata (`b8bd005`)
- Invalidate a conversation's persisted summary automatically when an edit or regenerate touches the already-summarized region (`7953788`)

## 1.2.0

### Features
- Add Google and DuckDuckGo search window tools that open dedicated webview windows for manual searching, with result scraping and fetch chaining (`8a7c794`)
  - Injects a floating "Done - send results" button into both search engines for collecting visible result links
  - Handles Google redirect URLs and DuckDuckGo `uddg` redirect URLs transparently
  - Falls back to returning visible page text when no result links can be parsed
  - Includes settings toggles for both search providers in the Web Search settings tab
- Update fetch-url tool description to guide agents to chain fetches after search window results

## 1.1.0

### Features
- Add web search and URL fetch tools, with provider settings UI for configuring web search (`59816c5`)
- Add agent sync script (`ai/scripts/sync-agents.ts`) (`4c2d008`)
- Add fixed/fluid chat width layout option with new appearance settings (`7e4d382`)

### Fixes
- Fix message list bug and update fetch URL handling (`798db5b`)

### Improvements
- Improve provider sync flow and polish settings UI (`481b458`)

### Documentation
- Add architecture documentation (`ARCHITECTURE.md`), remove unused greet command (`1ddb626`)
- Update README links and add architecture doc reference (`af820e6`, `8173d4d`)

## 1.0.0

- Initial release.
