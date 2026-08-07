"use client";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { proxyFetch } from "#lib/ai";
import type { Message, MessageModelInfo } from "#lib/types/chat";
import {
  createMessageId,
  getSelectedModelInfo,
  selectSelectedConversation,
  useChatStore,
} from "#store/chat";

type CoreMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

function buildCoreMessages(messages: Message[]): CoreMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));
}

export function useChat() {
  const conversation = useChatStore(selectSelectedConversation);
  const providers = useChatStore((state) => state.providers);
  const selectedModel = useChatStore((state) => state.selectedModel);
  const thinkingLevel = useChatStore((state) => state.thinkingLevel);
  const addMessage = useChatStore((state) => state.addMessage);
  const appendMessageContent = useChatStore((state) => state.appendMessageContent);
  const setMessageStatus = useChatStore((state) => state.setMessageStatus);
  const setMessageError = useChatStore((state) => state.setMessageError);
  const deleteMessage = useChatStore((state) => state.deleteMessage);
  const regenerateMessage = useChatStore((state) => state.regenerate);
  const editMessageInStore = useChatStore((state) => state.editMessage);

  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedModel.providerId),
    [providers, selectedModel.providerId],
  );

  const canSend = Boolean(activeProvider);

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

      abortControllerRef.current = new AbortController();
      setIsGenerating(true);

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

        const { textStream } = streamText({
          model,
          messages,
          abortSignal: abortControllerRef.current.signal,
        });

        for await (const textDelta of textStream) {
          appendMessageContent(conversationId, assistantMessage.id, textDelta);
        }

        setMessageStatus(conversationId, assistantMessage.id, "sent");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setMessageStatus(conversationId, assistantMessage.id, "sent");
          return;
        }

        const message = error instanceof Error ? error.message : "Failed to generate response";
        setMessageError(conversationId, assistantMessage.id, message);
        toast.error("Failed to generate response", {
          description: message,
        });
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [
      activeProvider,
      providers,
      selectedModel,
      thinkingLevel,
      addMessage,
      appendMessageContent,
      setMessageStatus,
      setMessageError,
    ],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversation || !activeProvider) {
        return;
      }

      const trimmed = content.trim();
      if (!trimmed) {
        return;
      }

      const userMessage: Message = {
        id: createMessageId(),
        role: "user",
        content: trimmed,
        createdAt: new Date(),
      };

      addMessage(conversation.id, userMessage);

      await streamAssistantResponse(conversation.id, [...conversation.messages, userMessage]);
    },
    [conversation, activeProvider, addMessage, streamAssistantResponse],
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
    canSend,
    sendMessage,
    stop,
    retry,
    regenerate,
    editMessage,
  };
}
