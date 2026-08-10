# 25 - personal-agent | Frontend - Manual compact button

**What to build:** A compact icon button next to the context usage indicator that runs compaction immediately, regardless of threshold.

**Blocked by:** #24 - Auto-compaction above the context threshold.

**Status:** Done

## Tasks

- [x] Button next to `ContextUsageIndicator` in `message-input.tsx`
- [x] Runs the same compaction path as auto-compact but ignores `shouldCompact` - always regenerates and persists a fresh summary when clicked

### Verify

- [x] Click the button on a short conversation, confirm it still compacts and the usage indicator updates accordingly
