"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { streamText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
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

      addMessage(conversation.id, userMessage);
      addMessage(conversation.id, assistantMessage);

      abortControllerRef.current = new AbortController();
      setIsGenerating(true);

      try {
        const fetchImpl =
          activeProvider.connectionMode === "proxy" ? proxyFetch : undefined;

        const provider = createOpenAICompatible({
          name: activeProvider.name,
          baseURL: activeProvider.baseUrl,
          apiKey: activeProvider.apiKey,
          fetch: fetchImpl,
        });

        const model = provider(selectedModel.modelId);
        const messages = buildCoreMessages([...conversation.messages, userMessage]);

        const { textStream } = streamText({
          model,
          messages,
          abortSignal: abortControllerRef.current.signal,
        });

        for await (const textDelta of textStream) {
          appendMessageContent(conversation.id, assistantMessage.id, textDelta);
        }

        setMessageStatus(conversation.id, assistantMessage.id, "sent");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setMessageStatus(conversation.id, assistantMessage.id, "sent");
          return;
        }

        const message = error instanceof Error ? error.message : "Failed to generate response";
        setMessageError(conversation.id, assistantMessage.id, message);
        toast.error("Failed to generate response", {
          description: message,
        });
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [
      conversation,
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
  };
}
