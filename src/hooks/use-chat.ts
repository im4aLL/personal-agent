"use client";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ImagePart, TextPart, UserContent } from "@ai-sdk/provider-utils";
import { streamText } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { proxyFetch } from "#lib/ai";
import { generateConversationTitle } from "#lib/title";
import type { Attachment, Message, MessageModelInfo } from "#lib/types/chat";
import {
  createMessageId,
  DEFAULT_CONVERSATION_TITLE,
  getSelectedModelInfo,
  selectSelectedConversation,
  useChatStore,
} from "#store/chat";

const MAX_STREAM_RETRIES = 2;
const STREAM_RETRY_BASE_DELAY_MS = 1000;

const THINKING_TO_REASONING: Record<string, "none" | "low" | "medium" | "high"> = {
  off: "none",
  low: "low",
  medium: "medium",
  high: "high",
};

function isRetryableStreamError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return false;
  if (error instanceof TypeError && error.message.includes("fetch")) return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("network") || msg.includes("timeout") || msg.includes("econnrefused"))
      return true;
  }
  return false;
}

function logProviderCall(details: {
  providerName: string;
  baseUrl: string;
  modelId: string;
  messageCount: number;
}) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(
      `[personal-agent] provider call: ${details.providerName} @ ${details.baseUrl} | model=${details.modelId} | messages=${details.messageCount}`,
    );
  }
}

const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

function buildUserContent(message: Message): UserContent {
  const imageAttachments =
    message.attachments?.filter((a) => a.data && IMAGE_MIME_TYPES.includes(a.type)) ?? [];

  if (imageAttachments.length === 0) {
    return message.content;
  }

  const parts: Array<TextPart | ImagePart> = [];

  for (const attachment of imageAttachments) {
    if (attachment.data) {
      parts.push({ type: "image", image: attachment.data });
    }
  }

  if (message.content.trim()) {
    parts.push({ type: "text", text: message.content });
  }

  return parts;
}

function buildCoreMessages(messages: Message[]) {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((message) => {
      if (message.role === "user") {
        return {
          role: "user" as const,
          content: buildUserContent(message),
        };
      }

      return {
        role: "assistant" as const,
        content: message.content,
      };
    });
}

export function useChat() {
  const conversation = useChatStore(selectSelectedConversation);
  const providers = useChatStore((state) => state.providers);
  const selectedModel = useChatStore((state) => state.selectedModel);
  const disabledModels = useChatStore((state) => state.disabledModels);
  const thinkingLevel = useChatStore((state) => state.thinkingLevel);
  const addMessage = useChatStore((state) => state.addMessage);
  const appendMessageContent = useChatStore((state) => state.appendMessageContent);
  const appendMessageReasoning = useChatStore((state) => state.appendMessageReasoning);
  const setMessageStatus = useChatStore((state) => state.setMessageStatus);
  const setMessageError = useChatStore((state) => state.setMessageError);
  const setConversationTitle = useChatStore((state) => state.setConversationTitle);
  const persistConversation = useChatStore((state) => state.persistConversation);
  const deleteMessage = useChatStore((state) => state.deleteMessage);
  const regenerateMessage = useChatStore((state) => state.regenerate);
  const editMessageInStore = useChatStore((state) => state.editMessage);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
      toast.success("Back online");
    }
    function handleOffline() {
      setIsOffline(true);
      toast.error("You are offline", {
        description: "Check your network connection.",
        duration: Infinity,
        id: "offline-toast",
      });
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (!navigator.onLine) {
      setIsOffline(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const activeProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedModel.providerId),
    [providers, selectedModel.providerId],
  );

  const canSend = Boolean(
    activeProvider &&
      !isOffline &&
      !disabledModels.has(`${selectedModel.providerId}:${selectedModel.modelId}`),
  );

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const streamAssistantResponse = useCallback(
    async (conversationId: string, contextMessages: Message[]) => {
      if (!activeProvider) {
        return;
      }

      const modelInfo: MessageModelInfo = getSelectedModelInfo({
        providers,
        selectedModel,
      });

      const assistantMessage: Message = {
        id: createMessageId(),
        role: "assistant",
        content: "",
        status: "streaming",
        createdAt: new Date(),
        model: modelInfo,
        thinkingLevel,
      };

      addMessage(conversationId, assistantMessage);

      logProviderCall({
        providerName: activeProvider.label,
        baseUrl: activeProvider.baseUrl,
        modelId: selectedModel.modelId,
        messageCount: contextMessages.length,
      });

      let lastError: unknown = null;

      for (let attempt = 0; attempt <= MAX_STREAM_RETRIES; attempt++) {
        abortControllerRef.current = new AbortController();

        if (attempt === 0) {
          setIsGenerating(true);
        }

        try {
          const fetchImpl = activeProvider.connectionMode === "proxy" ? proxyFetch : undefined;

          const provider = createOpenAICompatible({
            name: activeProvider.name,
            baseURL: activeProvider.baseUrl,
            apiKey: activeProvider.apiKey,
            fetch: fetchImpl,
          });

          const model = provider(selectedModel.modelId);
          const messages = buildCoreMessages(contextMessages);

          const { fullStream } = streamText({
            model,
            messages,
            abortSignal: abortControllerRef.current.signal,
            reasoning:
              thinkingLevel !== "off" ? (THINKING_TO_REASONING[thinkingLevel] ?? "medium") : "none",
          });

          for await (const part of fullStream) {
            if (part.type === "text-delta") {
              appendMessageContent(conversationId, assistantMessage.id, part.text);
            } else if (part.type === "reasoning-delta") {
              appendMessageReasoning(conversationId, assistantMessage.id, part.text);
            }
          }

          setMessageStatus(conversationId, assistantMessage.id, "sent");
          persistConversation(conversationId);

          const currentConversation = useChatStore
            .getState()
            .conversations.find((item) => item.id === conversationId);

          if (
            currentConversation &&
            currentConversation.title === DEFAULT_CONVERSATION_TITLE &&
            currentConversation.messages.length === 2 &&
            currentConversation.messages[0]?.role === "user" &&
            currentConversation.messages[1]?.id === assistantMessage.id
          ) {
            const firstUserMessage = currentConversation.messages[0].content;
            const titleProvider = providers.find((p) => p.id === modelInfo.providerId);

            if (titleProvider) {
              try {
                const title = await generateConversationTitle(
                  firstUserMessage,
                  titleProvider,
                  modelInfo.modelId,
                );
                setConversationTitle(conversationId, title);
                persistConversation(conversationId);
              } catch {
                setConversationTitle(conversationId, DEFAULT_CONVERSATION_TITLE);
                persistConversation(conversationId);
              }
            }
          }

          lastError = null;
          break;
        } catch (error) {
          lastError = error;

          if (error instanceof DOMException && error.name === "AbortError") {
            setMessageStatus(conversationId, assistantMessage.id, "sent");
            lastError = null;
            break;
          }

          if (!isRetryableStreamError(error) || attempt >= MAX_STREAM_RETRIES) {
            break;
          }

          const delay = STREAM_RETRY_BASE_DELAY_MS * 2 ** attempt;
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.log(
              `[personal-agent] stream retry ${attempt + 1}/${MAX_STREAM_RETRIES} after ${delay}ms`,
            );
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      if (lastError) {
        const message =
          lastError instanceof Error ? lastError.message : "Failed to generate response";
        const isNetworkError =
          lastError instanceof TypeError && lastError.message.includes("fetch");

        setMessageError(conversationId, assistantMessage.id, message);
        toast.error("Failed to generate response", {
          description: isNetworkError
            ? "Network error. Check your connection or try again."
            : activeProvider.connectionMode === "proxy"
              ? "Proxy request failed. The backend may be unreachable."
              : message,
        });
      }

      setIsGenerating(false);
      abortControllerRef.current = null;
    },
    [
      activeProvider,
      providers,
      selectedModel,
      thinkingLevel,
      addMessage,
      appendMessageContent,
      appendMessageReasoning,
      setMessageStatus,
      setMessageError,
      setConversationTitle,
      persistConversation,
    ],
  );

  const sendMessage = useCallback(
    async (content: string, attachments?: Attachment[]) => {
      if (!activeProvider) {
        return;
      }

      const trimmed = content.trim();
      const hasAttachments = attachments && attachments.length > 0;
      if (!trimmed && !hasAttachments) {
        return;
      }

      const currentConversation = selectSelectedConversation(useChatStore.getState());
      if (!currentConversation) {
        return;
      }

      const userMessage: Message = {
        id: createMessageId(),
        role: "user",
        content: trimmed,
        attachments: hasAttachments ? attachments : undefined,
        createdAt: new Date(),
      };

      addMessage(currentConversation.id, userMessage);

      await streamAssistantResponse(currentConversation.id, [
        ...currentConversation.messages,
        userMessage,
      ]);
    },
    [activeProvider, addMessage, streamAssistantResponse],
  );

  const regenerate = useCallback(async () => {
    if (!conversation || !activeProvider) {
      return;
    }

    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (lastMessage?.role !== "assistant") {
      return;
    }

    regenerateMessage(conversation.id);

    const currentConversation = useChatStore
      .getState()
      .conversations.find((item) => item.id === conversation.id);

    if (!currentConversation || currentConversation.messages.length === 0) {
      return;
    }

    await streamAssistantResponse(currentConversation.id, currentConversation.messages);
  }, [conversation, activeProvider, regenerateMessage, streamAssistantResponse]);

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!conversation || !activeProvider) {
        return;
      }

      const target = conversation.messages.find((message) => message.id === messageId);
      if (target?.role !== "user") {
        return;
      }

      editMessageInStore(conversation.id, messageId, content);

      const currentConversation = useChatStore
        .getState()
        .conversations.find((item) => item.id === conversation.id);

      if (!currentConversation || currentConversation.messages.length === 0) {
        return;
      }

      await streamAssistantResponse(currentConversation.id, currentConversation.messages);
    },
    [conversation, activeProvider, editMessageInStore, streamAssistantResponse],
  );

  const retry = useCallback(() => {
    if (!conversation) {
      return;
    }

    const messages = conversation.messages;
    let errorIndex = -1;
    for (let index = messages.length - 1; index >= 0; index--) {
      const message = messages[index];
      if (message?.role === "assistant" && message.status === "error") {
        errorIndex = index;
        break;
      }
    }

    if (errorIndex === -1) {
      return;
    }

    let userMessage: Message | undefined;
    for (let index = errorIndex - 1; index >= 0; index--) {
      const message = messages[index];
      if (message?.role === "user") {
        userMessage = message;
        break;
      }
    }

    if (!userMessage) {
      return;
    }

    const errorMessage = messages[errorIndex];
    if (!errorMessage) {
      return;
    }

    deleteMessage(conversation.id, errorMessage.id);
    void sendMessage(userMessage.content);
  }, [conversation, deleteMessage, sendMessage]);

  return {
    messages: conversation?.messages ?? [],
    isGenerating,
    isOffline,
    canSend,
    sendMessage,
    stop,
    retry,
    regenerate,
    editMessage,
  };
}
