import { create } from "zustand";
import {
  loadProviders,
  loadSelectedModel,
  saveProviders,
  saveSelectedModel,
  toStoredModelSelection,
  toStoredProvider,
} from "#lib/config";
import { MOCK_CONVERSATIONS } from "#lib/mock-data";
import type { ConnectionMode, ModelInfo, ProviderInput } from "#lib/providers";
import { fetchProviderModels } from "#lib/providers";
import type { Conversation, Message, MessageModelInfo } from "#lib/types/chat";

export type { ConnectionMode, ProviderInput };

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
};

export type ChatState = {
  conversations: Conversation[];
  selectedConversationId: string | null;
  selectedModel: { providerId: string; modelId: string };
  providers: ProviderInfo[];
  thinkingLevel: string;
  selectConversation: (id: string | null) => void;
  setSelectedModel: (providerId: string, modelId: string) => void;
  setConversations: (conversations: Conversation[]) => void;
  setThinkingLevel: (level: string) => void;
  addMessage: (conversationId: string, message: Message) => void;
  appendMessageContent: (conversationId: string, messageId: string, delta: string) => void;
  setMessageStatus: (conversationId: string, messageId: string, status: Message["status"]) => void;
  setMessageError: (conversationId: string, messageId: string, error: string) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  addProvider: (input: ProviderInput) => void;
  updateProvider: (id: string, input: ProviderInput) => void;
  deleteProvider: (id: string) => void;
  setDefaultProvider: (id: string) => void;
  refreshProviderModels: (providerId: string) => Promise<void>;
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
    baseUrl: "http://localhost:11434",
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
  modelId: "openai/gpt-4o",
};

export function createProviderId(label: string): string {
  return `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
}

function createProviderName(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function buildPresetProviders(): ProviderInfo[] {
  return PROVIDER_PRESETS.map((preset, index) => ({
    id: createProviderId(preset.label),
    name: createProviderName(preset.label),
    label: preset.label,
    baseUrl: preset.baseUrl,
    apiKey: preset.apiKey,
    isDefault: index === 0,
    connectionMode: preset.connectionMode,
    models: [],
  }));
}

function loadProviderState(): ProviderInfo[] {
  const stored = loadProviders();
  if (stored && stored.length > 0) {
    return stored.map((item) => ({
      ...item,
      models: [],
      isLoadingModels: false,
      modelsError: null,
    }));
  }

  return buildPresetProviders();
}

function loadModelSelection(): { providerId: string; modelId: string } {
  const stored = loadSelectedModel();
  if (!stored) {
    return DEFAULT_MODEL;
  }

  return {
    providerId: stored.providerId,
    modelId: stored.modelId,
  };
}

function loadConversations(): Conversation[] {
  return MOCK_CONVERSATIONS;
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
  const stored = providers.map((provider) =>
    toStoredProvider({
      id: provider.id,
      name: provider.name,
      label: provider.label,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      isDefault: provider.isDefault,
      connectionMode: provider.connectionMode,
    }),
  );
  saveProviders(stored);
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

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: loadConversations(),
  selectedConversationId: null,
  selectedModel: loadModelSelection(),
  providers: loadProviderState(),
  thinkingLevel: "off",

  selectConversation: (id) => set({ selectedConversationId: id }),

  setSelectedModel: (providerId, modelId) => {
    set({ selectedModel: { providerId, modelId } });
    persistSelectedModel({ providerId, modelId });
  },

  setConversations: (conversations) => set({ conversations }),
  setThinkingLevel: (level) => set({ thinkingLevel: level }),

  addMessage: (conversationId, message) => {
    set((state) => ({
      conversations: updateConversation(state, conversationId, (conversation) => ({
        ...conversation,
        messages: [...conversation.messages, message],
      })),
    }));
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
    set((state) => ({
      conversations: updateConversation(state, conversationId, (conversation) => ({
        ...conversation,
        messages: conversation.messages.filter((message) => message.id !== messageId),
      })),
    }));
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
      models: [],
      isLoadingModels: false,
      modelsError: null,
    };

    const nextProviders = [...state.providers, newProvider];
    set({ providers: nextProviders });
    persistProviders(nextProviders);
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
            models: [],
            modelsError: null,
          }
        : provider,
    );

    set({ providers: nextProviders });
    persistProviders(nextProviders);
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

    set({ providers: nextProviders });
    persistProviders(nextProviders);
  },

  setDefaultProvider: (id) => {
    const state = get();
    const nextProviders = state.providers.map((provider) => ({
      ...provider,
      isDefault: provider.id === id,
    }));

    set({ providers: nextProviders });
    persistProviders(nextProviders);
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

      set({ providers: nextProviders });
      persistProviders(nextProviders);
    } catch (error) {
      const nextState = get();
      const message = error instanceof Error ? error.message : "Failed to fetch models";
      const nextProviders = nextState.providers.map((item) =>
        item.id === providerId ? { ...item, isLoadingModels: false, modelsError: message } : item,
      );

      set({ providers: nextProviders });
      persistProviders(nextProviders);
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
