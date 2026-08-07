import { create } from "zustand";
import { MOCK_CONVERSATIONS } from "#lib/mock-data";
import type { Conversation } from "#lib/types/chat";

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
  selectConversation: (id: string | null) => void;
  setSelectedModel: (providerId: string, modelId: string) => void;
  setConversations: (conversations: Conversation[]) => void;
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

export const useChatStore = create<ChatState>((set) => ({
  conversations: loadConversations(),
  selectedConversationId: null,
  selectedModel: DEFAULT_MODEL,
  providers: MOCK_PROVIDERS,
  selectConversation: (id) => set({ selectedConversationId: id }),
  setSelectedModel: (providerId, modelId) => set({ selectedModel: { providerId, modelId } }),
  setConversations: (conversations) => set({ conversations }),
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
