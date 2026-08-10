# Changelog

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
