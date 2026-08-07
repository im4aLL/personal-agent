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
  models: ModelInfo[];
};

export type ChatState = {
  conversations: Conversation[];
  selectedConversationId: string | null;
  selectedModel: { providerId: string; modelId: string };
  providers: ProviderInfo[];
  selectConversation: (id: string | null) => void;
  setSelectedModel: (providerId: string, modelId: string) => void;
};

export const MOCK_PROVIDERS: ProviderInfo[] = [
  {
    id: "opencode-go",
    name: "opencode-go",
    models: [
      { id: "openai/gpt-4o", name: "GPT-4o" },
      { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
      { id: "anthropic/claude-3-5-sonnet", name: "Claude 3.5 Sonnet" },
    ],
  },
  {
    id: "ollama-local",
    name: "Ollama (local)",
    models: [
      { id: "llama3.2", name: "Llama 3.2" },
      { id: "qwen2.5", name: "Qwen 2.5" },
      { id: "mistral", name: "Mistral" },
    ],
  },
  {
    id: "lm-studio",
    name: "LM Studio",
    models: [{ id: "local-model", name: "Local Model" }],
  },
];

export const DEFAULT_MODEL = {
  providerId: "opencode-go",
  modelId: "openai/gpt-4o",
};

export const useChatStore = create<ChatState>((set) => ({
  conversations: MOCK_CONVERSATIONS,
  selectedConversationId: null,
  selectedModel: DEFAULT_MODEL,
  providers: MOCK_PROVIDERS,
  selectConversation: (id) => set({ selectedConversationId: id }),
  setSelectedModel: (providerId, modelId) => set({ selectedModel: { providerId, modelId } }),
}));

export function selectSelectedConversation(state: ChatState): Conversation | null {
  if (!state.selectedConversationId) return null;
  return (
    state.conversations.find((conversation) => conversation.id === state.selectedConversationId) ??
    null
  );
}
