# 13 - personal-agent | Frontend - Model toggle list and default model persistence

**What to build:** On the Settings > Providers page, each provider expands to show its fetched model list with per-model enable/disable toggles.
Disabled models are hidden from the model picker in the message box and new-chat dropdown.
When the user selects a model from the message box, that model is persisted as the default for new chats.
If the default model is later toggled off or removed, the app falls back to the first enabled model for that provider.

**Blocked by:** #5 - Provider management and model discovery

**Status:** Todo

## Tasks

### Model toggle list in settings
- [ ] Per-provider model list UI: each model row has a toggle switch (enabled/disabled).
- [ ] Persist enabled/disabled state per model per provider in localStorage (`personal-agent:disabled-models` or similar).
- [ ] New models discovered on fetch default to enabled (opt-out).
- [ ] Filter the model picker (message box, new-chat dropdown) to only show enabled models.

### Default model persistence
- [ ] When user selects a model in the message box, persist it as `personal-agent:default-model` (provider + model ID).
- [ ] New chats pre-select the persisted default model.
- [ ] If the default model is toggled off, fall back to the first enabled model for that provider.
- [ ] If a provider is removed, clear the default if it belonged to that provider.

### Edge cases
- [ ] Provider with zero enabled models: show a warning, disable sending until a model is enabled.
- [ ] Changing providers in the message box resets the model selection to that provider's first enabled model (or the persisted default if it belongs to the new provider).
