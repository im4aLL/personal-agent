import { create } from "zustand";
import { MOCK_CONVERSATIONS } from "#lib/mock-data";
import type { Conversation, Message, MessageModelInfo } from "#lib/types/chat";

export type ModelInfo = {
  id: string;
  name: string;
};

export type ProviderInfo = {
  id: string;
  name: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  isDefault: boolean;
  models: ModelInfo[];
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
  sendMessage: (content: string) => void;
};

export const MOCK_PROVIDERS: ProviderInfo[] = [
  {
    id: "opencode-go",
    name: "opencode-go",
    label: "Opencode Go",
    baseUrl: "https://api.opencode.ai",
    apiKey: "",
    isDefault: true,
    models: [
      { id: "openai/gpt-4o", name: "GPT-4o" },
      { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
      { id: "anthropic/claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
    ],
  },
  {
    id: "ollama-local",
    name: "ollama-local",
    label: "Ollama (local)",
    baseUrl: "http://localhost:11434",
    apiKey: "",
    isDefault: false,
    models: [
      { id: "llama3.2", name: "Llama 3.2" },
      { id: "qwen2.5", name: "Qwen 2.5" },
      { id: "mistral", name: "Mistral" },
    ],
  },
  {
    id: "lm-studio",
    name: "lm-studio",
    label: "LM Studio",
    baseUrl: "http://localhost:1234/v1",
    apiKey: "",
    isDefault: false,
    models: [{ id: "local-model", name: "Local Model" }],
  },
];

export const DEFAULT_MODEL = {
  providerId: "opencode-go",
  modelId: "openai/gpt-4o",
};

const DEFAULT_MESSAGE_MODEL: MessageModelInfo = {
  providerId: "opencode-go",
  providerName: "Opencode Go",
  modelId: "openai/gpt-4o",
  modelName: "GPT-4o",
};

const CONVERSATIONS_STORAGE_KEY = "personal-agent-conversations";

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") {
    return MOCK_CONVERSATIONS;
  }
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    if (!raw) return MOCK_CONVERSATIONS;
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return MOCK_CONVERSATIONS;
    return parsed.map((item) => ({
      ...(item as Conversation),
      createdAt: new Date((item as Conversation).createdAt),
      updatedAt: new Date((item as Conversation).updatedAt),
      messages: ((item as Conversation).messages ?? []).map((message) => ({
        ...message,
        model:
          message.role === "assistant" && !message.model ? DEFAULT_MESSAGE_MODEL : message.model,
        thinkingLevel:
          message.role === "assistant" && !message.thinkingLevel ? "off" : message.thinkingLevel,
        createdAt: new Date(message.createdAt),
        editedAt: message.editedAt ? new Date(message.editedAt) : undefined,
      })),
    }));
  } catch {
    return MOCK_CONVERSATIONS;
  }
}

function saveConversations(conversations: Conversation[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // Ignore storage errors (e.g. private mode).
  }
}

function createMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getSelectedModelInfo(state: ChatState): MessageModelInfo {
  const provider = state.providers.find((item) => item.id === state.selectedModel.providerId);
  const model = provider?.models.find((item) => item.id === state.selectedModel.modelId);
  return {
    providerId: state.selectedModel.providerId,
    providerName: provider?.label ?? state.selectedModel.providerId,
    modelId: state.selectedModel.modelId,
    modelName: model?.name ?? state.selectedModel.modelId,
  };
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: loadConversations(),
  selectedConversationId: null,
  selectedModel: DEFAULT_MODEL,
  providers: MOCK_PROVIDERS,
  thinkingLevel: "off",
  selectConversation: (id) => set({ selectedConversationId: id }),
  setSelectedModel: (providerId, modelId) => set({ selectedModel: { providerId, modelId } }),
  setConversations: (conversations) => set({ conversations }),
  setThinkingLevel: (level) => set({ thinkingLevel: level }),
  sendMessage: (content) => {
    const state = get();
    const conversationId = state.selectedConversationId;
    if (!conversationId) return;

    const conversation = state.conversations.find((item) => item.id === conversationId);
    if (!conversation) return;

    const now = new Date();
    const modelInfo = getSelectedModelInfo(state);
    const userMessage: Message = {
      id: createMessageId(),
      role: "user",
      content,
      createdAt: now,
    };
    const assistantMessage: Message = {
      id: createMessageId(),
      role: "assistant",
      content: `Mock response using ${modelInfo.providerName} / ${modelInfo.modelName} (thinking: ${state.thinkingLevel}).`,
      createdAt: new Date(now.getTime() + 1),
      model: modelInfo,
      thinkingLevel: state.thinkingLevel,
    };

    const updatedConversation: Conversation = {
      ...conversation,
      messages: [...conversation.messages, userMessage, assistantMessage],
      updatedAt: now,
    };

    set({
      conversations: state.conversations.map((item) =>
        item.id === conversationId ? updatedConversation : item,
      ),
    });
  },
}));

saveConversations(useChatStore.getState().conversations);

useChatStore.subscribe((state) => {
  saveConversations(state.conversations);
});

export function selectSelectedConversation(state: ChatState): Conversation | null {
  if (!state.selectedConversationId) return null;
  return (
    state.conversations.find((conversation) => conversation.id === state.selectedConversationId) ??
    null
  );
}
