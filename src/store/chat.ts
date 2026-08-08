"use client";

import { create } from "zustand";
import {
  loadDisabledModels,
  loadSelectedModel,
  saveDisabledModels,
  saveSelectedModel,
  toStoredModelSelection,
} from "#lib/config";
import * as providerEncryption from "#lib/providerEncryption";
import type { ProviderRecord } from "#lib/providerStorage";
import * as providerStorage from "#lib/providerStorage";
import type { MergeSummary, SyncStatus } from "#lib/providerSync";
import * as providerSync from "#lib/providerSync";
import type { ConnectionMode, ModelInfo, ProviderInput } from "#lib/providers";
import { fetchProviderModels } from "#lib/providers";
import { getTursoConfig } from "#lib/turso";
import {
  deleteConversation as deleteConversationRemote,
  deleteMessage as deleteMessageRemote,
  loadConversationSummaries,
  loadConversationsForMonth,
  loadMessages as loadMessagesRemote,
  runMigrations,
  saveConversation,
  saveMessage,
  truncateMessages,
} from "#lib/turso-repository";
import type { Conversation, ConversationSummary, Message, MessageModelInfo } from "#lib/types/chat";
import { applyMessageEdit, regenerateMessages } from "./chat-helpers";

export type { ConnectionMode, ProviderInput };

const PROVIDER_SYNC_KEY_STORAGE_KEY = "personal-agent:provider-sync-key";

export type ProviderInfo = {
  id: string;
  name: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  isDefault: boolean;
  connectionMode: ConnectionMode;
  models: ModelInfo[];
  isLoadingModels?: boolean;
  modelsError?: string | null;
  syncEnabled?: boolean;
};

export const DEFAULT_CONVERSATION_TITLE = "New chat";

export type MonthGroup = { month: string; label: string; count: number };

export type ChatState = {
  conversations: Conversation[];
  selectedConversationId: string | null;
  selectedModel: { providerId: string; modelId: string };
  providers: ProviderInfo[];
  thinkingLevel: string;
  isHistoryLoaded: boolean;
  isHistoryLoading: boolean;
  historyError: string | null;
  messagesLoading: Set<string>;
  loadedConversationIds: Set<string>;
  today: ConversationSummary[];
  yesterday: ConversationSummary[];
  previous7Days: ConversationSummary[];
  monthGroups: MonthGroup[];
  monthConversations: Record<string, ConversationSummary[]>;
  monthConversationLimits: Record<string, { limit: number; hasMore: boolean }>;
  monthsLoading: Set<string>;
  providerSyncEnabled: boolean;
  providerSyncKey: CryptoKey | null;
  providerSyncStatus: SyncStatus;
  providerSyncError: string | null;
  providerSyncSummary: MergeSummary | null;
  providerSyncPending: boolean;
  disabledModels: Set<string>;
  selectConversation: (id: string | null) => void;
  setSelectedModel: (providerId: string, modelId: string) => void;
  setConversations: (conversations: Conversation[]) => void;
  setThinkingLevel: (level: string) => void;
  createConversation: (selectAfterCreate?: boolean) => string;
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  togglePin: (id: string) => void;
  setConversationTitle: (id: string, title: string) => void;
  setConversationTags: (id: string, tags: string[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  appendMessageContent: (conversationId: string, messageId: string, delta: string) => void;
  appendMessageReasoning: (conversationId: string, messageId: string, delta: string) => void;
  setMessageStatus: (conversationId: string, messageId: string, status: Message["status"]) => void;
  setMessageError: (conversationId: string, messageId: string, error: string) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  regenerate: (conversationId: string) => void;
  editMessage: (conversationId: string, messageId: string, content: string) => void;
  persistConversation: (conversationId: string) => void;
  loadHistory: () => Promise<void>;
  loadMessagesForConversation: (conversationId: string) => Promise<void>;
  loadMonthConversations: (month: string, limit?: number) => Promise<void>;
  loadMoreMonthConversations: (month: string) => Promise<void>;
  addProvider: (input: ProviderInput) => void;
  updateProvider: (id: string, input: ProviderInput) => void;
  deleteProvider: (id: string) => void;
  setDefaultProvider: (id: string) => void;
  setProviderSyncEnabledFlag: (providerId: string, enabled: boolean) => void;
  refreshProviderModels: (providerId: string) => Promise<void>;
  enableProviderSync: (options: { passphrase?: string; recoveryKey?: string }) => Promise<void>;
  disableProviderSync: () => void;
  syncProviders: (
    onSummary?: (summary: MergeSummary) => Promise<boolean>,
  ) => Promise<providerSync.MergeResult>;
  loadProviderSyncKey: () => Promise<void>;
  toggleModelEnabled: (providerId: string, modelId: string, enabled: boolean) => void;
  setProviderModelsEnabled: (providerId: string, enabled: boolean) => void;
  setAllModelsEnabled: (enabled: boolean) => void;
  isModelEnabled: (providerId: string, modelId: string) => boolean;
  getEnabledModels: (providerId: string) => ModelInfo[];
};

export const PROVIDER_PRESETS: ProviderInput[] = [
  {
    label: "Opencode Go",
    baseUrl: "https://opencode.ai/zen/go/v1",
    apiKey: "",
    connectionMode: "direct",
  },
  {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    connectionMode: "direct",
  },
  {
    label: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    apiKey: "",
    connectionMode: "direct",
  },
  {
    label: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    apiKey: "",
    connectionMode: "direct",
  },
  {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "",
    connectionMode: "direct",
  },
];

const DEFAULT_MODEL = {
  providerId: "opencode-go",
  modelId: "mimo-v2.5",
};

export function createProviderId(label: string): string {
  return `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
}

function createProviderName(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function parseManualModels(value: string | undefined): ModelInfo[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((id) => ({ id, name: id }));
}

function recordToProvider(record: ProviderRecord): ProviderInfo {
  return {
    id: record.id,
    name: record.name,
    label: record.label,
    baseUrl: record.baseUrl,
    apiKey: record.apiKey,
    isDefault: record.isDefault,
    connectionMode: record.connectionMode,
    models: record.models ? record.models.map((id) => ({ id, name: id })) : [],
    isLoadingModels: false,
    modelsError: null,
    syncEnabled: record.syncEnabled,
  };
}

function providerToRecord(provider: ProviderInfo): ProviderRecord {
  return {
    id: provider.id,
    name: provider.name,
    label: provider.label,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    isDefault: provider.isDefault,
    connectionMode: provider.connectionMode,
    models: provider.models.map((model) => model.id),
    updated_at: new Date().toISOString(),
    syncEnabled: provider.syncEnabled,
  };
}

function loadProviderState(): ProviderInfo[] {
  return providerStorage.getAll().map(recordToProvider);
}

function loadModelSelection(
  providers: ProviderInfo[],
  disabledModels: Set<string>,
): { providerId: string; modelId: string } {
  const stored = loadSelectedModel();
  if (!stored) {
    return getFallbackModel(providers, disabledModels);
  }

  // Validate: the stored provider must exist and the stored model must be enabled.
  const provider = providers.find((p) => p.id === stored.providerId);
  if (!provider) {
    return getFallbackModel(providers, disabledModels);
  }

  const model = provider.models.find((m) => m.id === stored.modelId);
  if (!model) {
    return getFallbackModel(providers, disabledModels);
  }

  if (disabledModels.has(`${stored.providerId}:${stored.modelId}`)) {
    const firstEnabled = provider.models.find(
      (m) => !disabledModels.has(`${stored.providerId}:${m.id}`),
    );
    if (firstEnabled) {
      return { providerId: stored.providerId, modelId: firstEnabled.id };
    }

    return getFallbackModel(providers, disabledModels);
  }

  return {
    providerId: stored.providerId,
    modelId: stored.modelId,
  };
}

function getFallbackModel(
  providers: ProviderInfo[],
  disabledModels: Set<string>,
): { providerId: string; modelId: string } {
  for (const provider of providers) {
    const firstEnabled = provider.models.find((m) => !disabledModels.has(`${provider.id}:${m.id}`));
    if (firstEnabled) {
      return { providerId: provider.id, modelId: firstEnabled.id };
    }
  }

  return DEFAULT_MODEL;
}

function loadConversations(): Conversation[] {
  return [];
}

function isTursoConfigured(): boolean {
  return getTursoConfig() !== null;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

async function loadStoredProviderSyncKey(): Promise<CryptoKey | null> {
  if (!isBrowser()) {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(PROVIDER_SYNC_KEY_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    return providerEncryption.importKeyFromBase64(stored);
  } catch {
    return null;
  }
}

function clearStoredProviderSyncKey(): void {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.removeItem(PROVIDER_SYNC_KEY_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

export function createConversationId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getSelectedModelInfo(
  state: Pick<ChatState, "providers" | "selectedModel">,
): MessageModelInfo {
  const provider = state.providers.find((item) => item.id === state.selectedModel.providerId);
  const model = provider?.models.find((item) => item.id === state.selectedModel.modelId);

  return {
    providerId: state.selectedModel.providerId,
    providerName: provider?.label ?? state.selectedModel.providerId,
    modelId: state.selectedModel.modelId,
    modelName: model?.name ?? state.selectedModel.modelId,
  };
}

function persistProviders(providers: ProviderInfo[]) {
  providerStorage.saveAll(providers.map(providerToRecord));
}

function persistSelectedModel(selection: { providerId: string; modelId: string }) {
  saveSelectedModel(toStoredModelSelection(selection.providerId, selection.modelId));
}

function updateConversation(
  state: ChatState,
  conversationId: string,
  updater: (conversation: Conversation) => Conversation,
): Conversation[] {
  return state.conversations.map((conversation) =>
    conversation.id === conversationId
      ? updater({ ...conversation, updatedAt: new Date() })
      : conversation,
  );
}

const initialProviders = loadProviderState();
const initialDisabledModels = loadDisabledModels();

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: loadConversations(),
  selectedConversationId: null,
  selectedModel: loadModelSelection(initialProviders, initialDisabledModels),
  providers: initialProviders,
  thinkingLevel: "off",
  isHistoryLoaded: false,
  isHistoryLoading: false,
  historyError: null,
  messagesLoading: new Set(),
  loadedConversationIds: new Set(),
  today: [],
  yesterday: [],
  previous7Days: [],
  monthGroups: [],
  monthConversations: {},
  monthConversationLimits: {},
  monthsLoading: new Set(),
  providerSyncEnabled: providerStorage.isProviderSyncEnabled(),
  providerSyncKey: null,
  providerSyncStatus: "never-synced",
  providerSyncError: null,
  providerSyncSummary: null,
  providerSyncPending: false,
  disabledModels: initialDisabledModels,

  selectConversation: (id) => {
    set({ selectedConversationId: id });
    if (id && !get().loadedConversationIds.has(id)) {
      void get().loadMessagesForConversation(id);
    }
  },

  createConversation: (selectAfterCreate = false) => {
    const id = createConversationId();
    const newConversation: Conversation = {
      id,
      title: DEFAULT_CONVERSATION_TITLE,
      messages: [],
      pinned: false,
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    set((state) => ({
      conversations: [newConversation, ...state.conversations],
      selectedConversationId: selectAfterCreate ? id : state.selectedConversationId,
      loadedConversationIds: new Set([...state.loadedConversationIds, id]),
    }));

    return id;
  },

  renameConversation: (id, title) => {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }

    set((state) => {
      const nextConversations = updateConversation(state, id, (conversation) => ({
        ...conversation,
        title: trimmed,
      }));

      if (isTursoConfigured()) {
        const updated = nextConversations.find((c) => c.id === id);
        if (updated) {
          void saveConversation(updated);
        }
      }

      return { conversations: nextConversations };
    });
  },

  deleteConversation: (id) => {
    set((state) => {
      const nextConversations = state.conversations.filter(
        (conversation) => conversation.id !== id,
      );
      let nextSelectedId = state.selectedConversationId;

      if (state.selectedConversationId === id && nextConversations.length > 0) {
        const mostRecent = nextConversations.reduce((latest, current) =>
          current.updatedAt.getTime() > latest.updatedAt.getTime() ? current : latest,
        );
        nextSelectedId = mostRecent.id;
      } else if (state.selectedConversationId === id) {
        nextSelectedId = null;
      }

      if (isTursoConfigured()) {
        void deleteConversationRemote(id);
      }

      return {
        conversations: nextConversations,
        selectedConversationId: nextSelectedId,
        loadedConversationIds: (() => {
          const next = new Set(state.loadedConversationIds);
          next.delete(id);
          return next;
        })(),
        messagesLoading: (() => {
          const next = new Set(state.messagesLoading);
          next.delete(id);
          return next;
        })(),
      };
    });
  },

  setConversationTitle: (id, title) => {
    const trimmed = title.trim();
    set((state) => ({
      conversations: updateConversation(state, id, (conversation) => ({
        ...conversation,
        title: trimmed || conversation.title,
      })),
    }));
  },

  setConversationTags: (id, tags) => {
    set((state) => {
      const nextConversations = updateConversation(state, id, (conversation) => ({
        ...conversation,
        tags,
      }));

      if (isTursoConfigured()) {
        const updated = nextConversations.find((c) => c.id === id);
        if (updated) {
          void saveConversation(updated);
        }
      }

      return { conversations: nextConversations };
    });
  },

  togglePin: (id) => {
    set((state) => {
      const nextConversations = updateConversation(state, id, (conversation) => ({
        ...conversation,
        pinned: !conversation.pinned,
      }));

      if (isTursoConfigured()) {
        const updated = nextConversations.find((c) => c.id === id);
        if (updated) {
          void saveConversation(updated);
        }
      }

      return { conversations: nextConversations };
    });
  },

  setSelectedModel: (providerId, modelId) => {
    set({ selectedModel: { providerId, modelId } });
    persistSelectedModel({ providerId, modelId });
  },

  setConversations: (conversations) => set({ conversations }),
  setThinkingLevel: (level) => set({ thinkingLevel: level }),

  addMessage: (conversationId, message) => {
    set((state) => {
      if (isTursoConfigured()) {
        void saveMessage(conversationId, message);
      }

      return {
        conversations: updateConversation(state, conversationId, (conversation) => ({
          ...conversation,
          messages: [...conversation.messages, message],
        })),
      };
    });
  },

  appendMessageContent: (conversationId, messageId, delta) => {
    set((state) => ({
      conversations: updateConversation(state, conversationId, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === messageId ? { ...message, content: message.content + delta } : message,
        ),
      })),
    }));
  },

  appendMessageReasoning: (conversationId, messageId, delta) => {
    set((state) => ({
      conversations: updateConversation(state, conversationId, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          const currentReasoning = message.reasoning?.content ?? "";
          return {
            ...message,
            reasoning: { content: currentReasoning + delta },
          };
        }),
      })),
    }));
  },

  setMessageStatus: (conversationId, messageId, status) => {
    set((state) => ({
      conversations: updateConversation(state, conversationId, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === messageId ? { ...message, status } : message,
        ),
      })),
    }));
  },

  setMessageError: (conversationId, messageId, error) => {
    set((state) => ({
      conversations: updateConversation(state, conversationId, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) =>
          message.id === messageId ? { ...message, status: "error" as const, error } : message,
        ),
      })),
    }));
  },

  deleteMessage: (conversationId, messageId) => {
    set((state) => {
      if (isTursoConfigured()) {
        void deleteMessageRemote(messageId);
      }

      return {
        conversations: updateConversation(state, conversationId, (conversation) => ({
          ...conversation,
          messages: conversation.messages.filter((message) => message.id !== messageId),
        })),
      };
    });
  },

  persistConversation: (conversationId) => {
    if (!isTursoConfigured()) return;
    const state = get();
    if (!state.loadedConversationIds.has(conversationId)) {
      // Conversation messages not loaded yet - skipping persist to avoid data loss.
      return;
    }
    const conversation = state.conversations.find((c) => c.id === conversationId);
    if (conversation) {
      void saveConversation(conversation);
    }
  },

  loadHistory: async () => {
    set({ isHistoryLoading: true, historyError: null });

    try {
      if (!isTursoConfigured()) {
        set({ isHistoryLoaded: true, isHistoryLoading: false });
        return;
      }

      await runMigrations();
      const summaries = await loadConversationSummaries();

      // Each conversation gets an empty messages array - messages load lazily on select.
      const conversations: Conversation[] = [
        ...summaries.pinned.map((s) => ({ ...s, messages: [] })),
        ...summaries.today.map((s) => ({ ...s, messages: [] })),
        ...summaries.yesterday.map((s) => ({ ...s, messages: [] })),
        ...summaries.previous7Days.map((s) => ({ ...s, messages: [] })),
      ];

      set({
        conversations,
        today: summaries.today,
        yesterday: summaries.yesterday,
        previous7Days: summaries.previous7Days,
        monthGroups: summaries.monthGroups,
        isHistoryLoaded: true,
        isHistoryLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load history";
      set({ historyError: message, isHistoryLoaded: true, isHistoryLoading: false });
    }
  },

  loadMessagesForConversation: async (conversationId) => {
    const state = get();

    // Already loaded or already loading.
    if (
      state.loadedConversationIds.has(conversationId) ||
      state.messagesLoading.has(conversationId)
    ) {
      return;
    }

    set({ messagesLoading: new Set([...state.messagesLoading, conversationId]) });

    try {
      const messages = await loadMessagesRemote(conversationId);

      set((currentState) => {
        const existing = currentState.conversations.find((c) => c.id === conversationId);
        const nextConversations = existing
          ? currentState.conversations.map((c) =>
              c.id === conversationId ? { ...c, messages } : c,
            )
          : [
              ...currentState.conversations,
              {
                id: conversationId,
                title: "Unknown",
                messages,
                pinned: false,
                tags: [],
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ];

        return {
          conversations: nextConversations,
          loadedConversationIds: new Set([...currentState.loadedConversationIds, conversationId]),
          messagesLoading: (() => {
            const next = new Set(currentState.messagesLoading);
            next.delete(conversationId);
            return next;
          })(),
        };
      });
    } catch {
      // Remove from loading set on error.
      set((currentState) => ({
        messagesLoading: (() => {
          const next = new Set(currentState.messagesLoading);
          next.delete(conversationId);
          return next;
        })(),
      }));
    }
  },

  loadMonthConversations: async (month, limit = 50) => {
    const state = get();

    // Already loaded with at least the default limit, or already loading.
    if (state.monthsLoading.has(month)) return;
    if (state.monthConversations[month] && limit <= 50) return;

    set({ monthsLoading: new Set([...get().monthsLoading, month]) });

    try {
      const summaries = await loadConversationsForMonth(month, limit);

      // Convert summaries to full Conversation objects (with empty messages).
      const conversations: Conversation[] = summaries.map((s) => ({ ...s, messages: [] }));

      set((currentState) => {
        // Deduplicate: skip conversations already in the array (e.g., added via search fallback).
        const existingIds = new Set(currentState.conversations.map((c) => c.id));
        const newConversations = conversations.filter((c) => !existingIds.has(c.id));

        return {
          conversations: [...currentState.conversations, ...newConversations],
          monthConversations: {
            ...currentState.monthConversations,
            [month]: summaries,
          },
          monthConversationLimits: {
            ...currentState.monthConversationLimits,
            [month]: { limit, hasMore: summaries.length === limit },
          },
        };
      });
    } catch {
      // Silently fail - month group stays collapsed.
    } finally {
      set((currentState) => ({
        monthsLoading: (() => {
          const next = new Set(currentState.monthsLoading);
          next.delete(month);
          return next;
        })(),
      }));
    }
  },

  loadMoreMonthConversations: async (month) => {
    const state = get();
    const current = state.monthConversationLimits[month];
    if (!current || state.monthsLoading.has(month)) return;

    set({ monthsLoading: new Set([...get().monthsLoading, month]) });

    const newLimit = current.limit * 2;

    try {
      const summaries = await loadConversationsForMonth(month, newLimit);
      const conversations: Conversation[] = summaries.map((s) => ({ ...s, messages: [] }));

      set((currentState) => {
        // Remove old unpinned month entries from conversations, keeping pinned ones.
        const oldIds = new Set(
          (currentState.monthConversations[month] ?? []).map((c) => c.id),
        );
        const filteredConversations = currentState.conversations.filter(
          (c) => !(oldIds.has(c.id) && !c.pinned),
        );

        return {
          conversations: [...filteredConversations, ...conversations],
          monthConversations: {
            ...currentState.monthConversations,
            [month]: summaries,
          },
          monthConversationLimits: {
            ...currentState.monthConversationLimits,
            [month]: { limit: newLimit, hasMore: summaries.length === newLimit },
          },
        };
      });
    } catch {
      // Silently fail.
    } finally {
      set((currentState) => ({
        monthsLoading: (() => {
          const next = new Set(currentState.monthsLoading);
          next.delete(month);
          return next;
        })(),
      }));
    }
  },

  regenerate: (conversationId) => {
    set((state) => {
      if (!state.loadedConversationIds.has(conversationId)) {
        // Messages not loaded yet - nothing to regenerate.
        return {};
      }

      const conversation = state.conversations.find((c) => c.id === conversationId);
      if (!conversation || conversation.messages.length === 0) {
        return {};
      }

      return {
        conversations: updateConversation(state, conversationId, (conversation) => ({
          ...conversation,
          messages: regenerateMessages(conversation.messages),
        })),
      };
    });
  },

  editMessage: (conversationId, messageId, content) => {
    set((state) => {
      const conversation = state.conversations.find((c) => c.id === conversationId);
      if (!conversation || !state.loadedConversationIds.has(conversationId)) {
        // Messages not loaded yet - cannot edit.
        return {};
      }

      if (isTursoConfigured()) {
        void (async () => {
          await truncateMessages(conversationId, messageId);
          const currentState = get();
          const conversation = currentState.conversations.find((c) => c.id === conversationId);
          if (conversation) {
            await saveConversation(conversation);
          }
        })();
      }

      return {
        conversations: updateConversation(state, conversationId, (conversation) => ({
          ...conversation,
          messages: applyMessageEdit(conversation.messages, messageId, content),
        })),
      };
    });
  },

  addProvider: (input) => {
    const state = get();
    const newProvider: ProviderInfo = {
      id: createProviderId(input.label),
      name: createProviderName(input.label),
      label: input.label,
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      isDefault: state.providers.length === 0,
      connectionMode: input.connectionMode,
      models: parseManualModels(input.models),
      isLoadingModels: false,
      modelsError: null,
      syncEnabled: state.providerSyncEnabled,
    };

    const nextProviders = [...state.providers, newProvider];
    set({ providers: nextProviders });
    persistProviders(nextProviders);
    void get().syncProviders();
  },

  updateProvider: (id, input) => {
    const state = get();
    const nextProviders = state.providers.map((provider) =>
      provider.id === id
        ? {
            ...provider,
            label: input.label,
            name: createProviderName(input.label),
            baseUrl: input.baseUrl,
            apiKey: input.apiKey,
            connectionMode: input.connectionMode,
            models: parseManualModels(input.models),
            modelsError: null,
          }
        : provider,
    );

    set({ providers: nextProviders });
    persistProviders(nextProviders);
    void get().syncProviders();
  },

  deleteProvider: (id) => {
    const state = get();
    const remaining = state.providers.filter((provider) => provider.id !== id);
    const needsNewDefault =
      remaining.length > 0 && !remaining.some((provider) => provider.isDefault);

    const nextProviders = needsNewDefault
      ? remaining.map((provider, index) =>
          index === 0 ? { ...provider, isDefault: true } : provider,
        )
      : remaining;

    // Clear default model if it belonged to the deleted provider.
    let nextSelectedModel = state.selectedModel;
    if (state.selectedModel.providerId === id) {
      const defaultProvider = nextProviders.find((p) => p.isDefault) ?? nextProviders[0];
      if (defaultProvider) {
        const firstEnabled =
          defaultProvider.models.find(
            (m) => !state.disabledModels.has(`${defaultProvider.id}:${m.id}`),
          ) ?? defaultProvider.models[0];
        if (firstEnabled) {
          nextSelectedModel = { providerId: defaultProvider.id, modelId: firstEnabled.id };
          persistSelectedModel(nextSelectedModel);
        } else {
          nextSelectedModel = { providerId: defaultProvider.id, modelId: "" };
          persistSelectedModel(nextSelectedModel);
        }
      } else {
        nextSelectedModel = { providerId: "", modelId: "" };
        persistSelectedModel(nextSelectedModel);
      }
    }

    set({ providers: nextProviders, selectedModel: nextSelectedModel });
    persistProviders(nextProviders);
    void get().syncProviders();
  },

  setDefaultProvider: (id) => {
    const state = get();
    const nextProviders = state.providers.map((provider) => ({
      ...provider,
      isDefault: provider.id === id,
    }));

    set({ providers: nextProviders });
    persistProviders(nextProviders);
    void get().syncProviders();
  },

  setProviderSyncEnabledFlag: (providerId, enabled) => {
    const state = get();
    const nextProviders = state.providers.map((provider) =>
      provider.id === providerId ? { ...provider, syncEnabled: enabled } : provider,
    );

    set({ providers: nextProviders });
    persistProviders(nextProviders);
    void get().syncProviders();
  },

  refreshProviderModels: async (providerId) => {
    const state = get();
    const provider = state.providers.find((item) => item.id === providerId);
    if (!provider) {
      return;
    }

    set({
      providers: state.providers.map((item) =>
        item.id === providerId ? { ...item, isLoadingModels: true, modelsError: null } : item,
      ),
    });

    try {
      const result = await fetchProviderModels({
        id: provider.id,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        connectionMode: provider.connectionMode,
      });

      const nextState = get();
      const nextProviders = nextState.providers.map((item) =>
        item.id === providerId
          ? {
              ...item,
              models: result.models,
              connectionMode: result.usedProxy ? "proxy" : item.connectionMode,
              isLoadingModels: false,
              modelsError: null,
            }
          : item,
      );

      const selectedModel = nextState.selectedModel;
      if (
        selectedModel.providerId === providerId &&
        result.models.length > 0 &&
        !result.models.some((model) => model.id === selectedModel.modelId)
      ) {
        const fallbackModelId = result.models[0]?.id ?? selectedModel.modelId;
        set({
          providers: nextProviders,
          selectedModel: { providerId, modelId: fallbackModelId },
        });
        persistProviders(nextProviders);
        persistSelectedModel({ providerId, modelId: fallbackModelId });
      } else {
        set({ providers: nextProviders });
        persistProviders(nextProviders);
      }
    } catch (error) {
      const nextState = get();
      const message = error instanceof Error ? error.message : "Failed to fetch models";
      const currentProvider = nextState.providers.find((item) => item.id === providerId);
      const fallbackModels = currentProvider?.models ?? [];

      const nextProviders = nextState.providers.map((item) =>
        item.id === providerId
          ? {
              ...item,
              isLoadingModels: false,
              modelsError: fallbackModels.length === 0 ? message : null,
            }
          : item,
      );

      set({ providers: nextProviders });
      persistProviders(nextProviders);
    }
  },

  toggleModelEnabled: (providerId, modelId, enabled) => {
    const state = get();
    const key = `${providerId}:${modelId}`;
    const next = new Set(state.disabledModels);

    if (enabled) {
      next.delete(key);
    } else {
      next.add(key);
    }

    set({ disabledModels: next });
    saveDisabledModels(next);

    // If the toggled model was the selected model, fall back to first enabled.
    if (
      !enabled &&
      state.selectedModel.providerId === providerId &&
      state.selectedModel.modelId === modelId
    ) {
      const provider = state.providers.find((p) => p.id === providerId);
      if (provider) {
        const firstEnabled = provider.models.find((m) => !next.has(`${providerId}:${m.id}`));
        if (firstEnabled) {
          set({ selectedModel: { providerId, modelId: firstEnabled.id } });
          persistSelectedModel({ providerId, modelId: firstEnabled.id });
        } else {
          // No enabled models left in this provider. Fall back to another provider.
          const fallback = getFallbackModel(state.providers, next);
          set({ selectedModel: fallback });
          persistSelectedModel(fallback);
        }
      }
    }
  },

  setProviderModelsEnabled: (providerId, enabled) => {
    const state = get();
    const provider = state.providers.find((p) => p.id === providerId);
    if (!provider || provider.models.length === 0) return;

    const next = new Set(state.disabledModels);
    for (const model of provider.models) {
      const key = `${providerId}:${model.id}`;
      if (enabled) {
        next.delete(key);
      } else {
        next.add(key);
      }
    }

    set({ disabledModels: next });
    saveDisabledModels(next);
  },

  setAllModelsEnabled: (enabled) => {
    const state = get();
    const allModelKeys: string[] = [];
    for (const provider of state.providers) {
      for (const model of provider.models) {
        allModelKeys.push(`${provider.id}:${model.id}`);
      }
    }

    if (allModelKeys.length === 0) return;

    const next = new Set(state.disabledModels);
    for (const key of allModelKeys) {
      if (enabled) {
        next.delete(key);
      } else {
        next.add(key);
      }
    }

    set({ disabledModels: next });
    saveDisabledModels(next);
  },

  isModelEnabled: (providerId, modelId) => {
    return !get().disabledModels.has(`${providerId}:${modelId}`);
  },

  getEnabledModels: (providerId) => {
    const state = get();
    const provider = state.providers.find((p) => p.id === providerId);
    if (!provider) {
      return [];
    }

    return provider.models.filter((m) => !state.disabledModels.has(`${providerId}:${m.id}`));
  },

  loadProviderSyncKey: async () => {
    if (!providerStorage.isProviderSyncEnabled()) {
      return;
    }

    const key = await loadStoredProviderSyncKey();
    if (key) {
      set({ providerSyncKey: key });
      // Automatically sync on load to update status.
      // No onSummary callback - if data is unchanged this is a no-op status update.
      // If data differs, changes are applied without confirmation since sync was already
      // enabled by the user on a previous session.
      void get().syncProviders();
    }
  },

  enableProviderSync: async (options) => {
    let key: CryptoKey;

    try {
      if (options.recoveryKey) {
        key = await providerEncryption.importKeyFromBase64(options.recoveryKey);
      } else if (options.passphrase) {
        key = await providerEncryption.deriveKeyFromPassphrase(options.passphrase);
      } else {
        throw new Error("Provide a passphrase or recovery key to enable sync.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid encryption key";
      set({ providerSyncError: message, providerSyncStatus: "error" });
      throw error;
    }

    if (options.recoveryKey && isBrowser()) {
      try {
        window.localStorage.setItem(PROVIDER_SYNC_KEY_STORAGE_KEY, options.recoveryKey);
      } catch {
        // Ignore storage errors.
      }
    }

    providerStorage.setProviderSyncEnabled(true);
    set({ providerSyncEnabled: true, providerSyncKey: key, providerSyncError: null });
  },

  disableProviderSync: () => {
    providerStorage.setProviderSyncEnabled(false);
    clearStoredProviderSyncKey();
    set({
      providerSyncEnabled: false,
      providerSyncKey: null,
      providerSyncStatus: "never-synced",
      providerSyncError: null,
    });
  },

  syncProviders: async (onSummary) => {
    const state = get();

    if (!state.providerSyncEnabled || !state.providerSyncKey) {
      return { summary: { imports: [], overwrites: [], pushes: [] }, applied: false };
    }

    if (!isTursoConfigured()) {
      set({ providerSyncStatus: "error", providerSyncError: "Turso is not configured." });
      return { summary: { imports: [], overwrites: [], pushes: [] }, applied: false };
    }

    set({ providerSyncPending: true, providerSyncStatus: "pending", providerSyncError: null });

    try {
      await runMigrations();
      const result = await providerSync.mergeAndApply(state.providerSyncKey, onSummary);

      if (result.applied) {
        set({
          providers: loadProviderState(),
          providerSyncStatus: "synced",
          providerSyncError: null,
        });
      } else {
        set({
          providerSyncStatus: state.providerSyncStatus === "synced" ? "synced" : "never-synced",
        });
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider sync failed";
      set({ providerSyncStatus: "error", providerSyncError: message });
      return { summary: { imports: [], overwrites: [], pushes: [] }, applied: false };
    } finally {
      set({ providerSyncPending: false });
    }
  },
}));

export function selectSelectedConversation(state: ChatState): Conversation | null {
  if (!state.selectedConversationId) {
    return null;
  }

  return (
    state.conversations.find((conversation) => conversation.id === state.selectedConversationId) ??
    null
  );
}
