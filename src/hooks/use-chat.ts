"use client";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ImagePart, TextPart, UserContent } from "@ai-sdk/provider-utils";
import { APICallError, stepCountIs, streamText, type Tool } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { proxyFetch } from "#lib/ai";
import {
  loadDuckDuckGoSearchEnabled,
  loadFetchEnabled,
  loadGoogleSearchEnabled,
  loadTavilyApiKey,
  loadWebSearchEnabled,
} from "#lib/config";
import {
  buildOutgoingContext,
  estimateTextTokens,
  estimateTokens,
  getContextWindow,
  IMAGE_MIME_TYPES,
  shouldCompact,
} from "#lib/context";
import { generateConversationSummary, generateConversationTitle } from "#lib/title";
import { createDuckDuckGoSearchTool } from "#lib/tools/duckduckgo-search";
import { createFetchUrlTool } from "#lib/tools/fetch-url";
import { createGoogleSearchTool } from "#lib/tools/google-search";
import { createWebSearchTool } from "#lib/tools/web-search";
import type { Attachment, Message, MessageModelInfo } from "#lib/types/chat";
import { useAgentsStore } from "#store/agents";
import {
  createMessageId,
  DEFAULT_CONVERSATION_TITLE,
  getSelectedModelInfo,
  selectSelectedConversation,
  useChatStore,
} from "#store/chat";

const MAX_STREAM_RETRIES = 2;
const STREAM_RETRY_BASE_DELAY_MS = 1000;

// Messages kept raw (never summarized) once compaction fires, per
// plans/context-compaction.md.
const COMPACTION_TAIL_SIZE = 18;

function compactionTailSize(messageCount: number): number {
  if (messageCount <= 1) {
    return 0;
  }

  return Math.min(COMPACTION_TAIL_SIZE, messageCount - 1);
}

const THINKING_TO_REASONING: Record<string, "none" | "low" | "medium" | "high"> = {
  off: "none",
  low: "low",
  medium: "medium",
  high: "high",
};

const GEMINI_BASE_URL_MARKER = "generativelanguage.googleapis.com";

// The AI SDK's generic OpenAI-compatible layer drops Gemini's required
// `thought_signature` on function-call turns, so multi-turn tool calls always
// fail with a 400 on Gemini models. Disable tools for them until that's fixed
// upstream: https://github.com/vercel/ai/issues/11590
function isGeminiProvider(baseUrl: string): boolean {
  return baseUrl.includes(GEMINI_BASE_URL_MARKER);
}

function buildEnabledTools(): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  if (loadFetchEnabled()) {
    tools.fetchUrl = createFetchUrlTool();
  }

  if (loadWebSearchEnabled()) {
    const apiKey = loadTavilyApiKey();
    if (apiKey) {
      tools.webSearch = createWebSearchTool(apiKey);
    }
  }

  if (loadGoogleSearchEnabled()) {
    tools.googleSearch = createGoogleSearchTool();
  }

  if (loadDuckDuckGoSearchEnabled()) {
    tools.duckduckgoSearch = createDuckDuckGoSearchTool();
  }

  return tools;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

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

const BASE_SYSTEM_PROMPT =
  "You are an AI assistant in Personal Agent, a desktop app created by Hadi (https://github.com/im4aLL).";

export function systemPromptFromState(state: {
  activeInstructionId: string | null;
  activeSkillId: string | null;
  activeAgentId: string | null;
  userInstructions: Array<{ id: string; content?: string | null }>;
  skills: Array<{ id: string; content?: string | null }>;
  customAgents: Array<{ id: string; content?: string | null }>;
}): string | undefined {
  const parts: string[] = [BASE_SYSTEM_PROMPT];

  if (state.activeInstructionId) {
    const instruction = state.userInstructions.find((i) => i.id === state.activeInstructionId);
    if (instruction?.content) parts.push(instruction.content);
  }

  if (state.activeSkillId) {
    const skill = state.skills.find((s) => s.id === state.activeSkillId);
    if (skill?.content) parts.push(skill.content);
  }

  if (state.activeAgentId) {
    const agent = state.customAgents.find((a) => a.id === state.activeAgentId);
    if (agent?.content) parts.push(agent.content);
  }

  return parts.join("\n\n");
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
  const setConversationSummary = useChatStore((state) => state.setConversationSummary);
  const persistConversation = useChatStore((state) => state.persistConversation);
  const deleteMessage = useChatStore((state) => state.deleteMessage);
  const regenerateMessage = useChatStore((state) => state.regenerate);
  const editMessageInStore = useChatStore((state) => state.editMessage);

  // Agents store
  const activeInstructionId = useAgentsStore((s) => s.activeInstructionId);
  const activeSkillId = useAgentsStore((s) => s.activeSkillId);
  const activeAgentId = useAgentsStore((s) => s.activeAgentId);
  const userInstructions = useAgentsStore((s) => s.userInstructions);
  const agentSkills = useAgentsStore((s) => s.skills);
  const agentCustomAgents = useAgentsStore((s) => s.customAgents);

  const systemPrompt = useMemo(
    () =>
      systemPromptFromState({
        activeInstructionId,
        activeSkillId,
        activeAgentId,
        userInstructions,
        skills: agentSkills,
        customAgents: agentCustomAgents,
      }),
    [
      activeInstructionId,
      activeSkillId,
      activeAgentId,
      userInstructions,
      agentSkills,
      agentCustomAgents,
    ],
  );

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

  useEffect(() => {
    if (!import.meta.env.DEV || !conversation || !activeProvider) {
      return;
    }

    // Skip mid-stream: content grows on every delta, so logging here would
    // flood the console and re-scan the whole message list each time.
    if (conversation.messages.some((message) => message.status === "streaming")) {
      return;
    }

    const outgoing = buildOutgoingContext(conversation.messages, {
      summary: conversation.summary,
      summarizedUpToId: conversation.summarizedUpToId,
    });
    const combinedSystemPrompt = outgoing.summaryText
      ? [systemPrompt, `Summary of earlier conversation:\n${outgoing.summaryText}`]
          .filter(Boolean)
          .join("\n\n")
      : (systemPrompt ?? "");
    const tokens = estimateTokens(outgoing.messages) + estimateTextTokens(combinedSystemPrompt);
    const window = getContextWindow(activeProvider.baseUrl, selectedModel.modelId);

    // eslint-disable-next-line no-console
    console.log(
      `[personal-agent] context usage: ~${tokens} tokens / ${window} window (${outgoing.messages.length} outgoing messages, incl. system prompt${outgoing.summaryText ? " + summary" : ""})`,
    );
  }, [conversation, activeProvider, selectedModel.modelId, systemPrompt]);

  const canSend = Boolean(
    activeProvider &&
      !isOffline &&
      !disabledModels.has(`${selectedModel.providerId}:${selectedModel.modelId}`),
  );

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const streamAssistantResponse = useCallback(
    async (conversationId: string, contextMessages: Message[], systemPrompt?: string) => {
      if (!activeProvider) {
        return;
      }

      setIsGenerating(true);
      abortControllerRef.current = new AbortController();
      const compactionSignal = abortControllerRef.current.signal;

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

      const storedConversation = useChatStore
        .getState()
        .conversations.find((item) => item.id === conversationId);

      let outgoing = buildOutgoingContext(contextMessages, {
        summary: storedConversation?.summary,
        summarizedUpToId: storedConversation?.summarizedUpToId,
      });

      const hasValidSummary = outgoing.summaryText !== null;
      const rawTailSize = compactionTailSize(contextMessages.length);
      let compactionFailed = false;

      if (!hasValidSummary && rawTailSize > 0) {
        const tokens = estimateTokens(contextMessages) + estimateTextTokens(systemPrompt ?? "");
        const contextWindow = getContextWindow(activeProvider.baseUrl, selectedModel.modelId);

        if (shouldCompact(tokens, contextWindow)) {
          const toSummarize = contextMessages.slice(0, contextMessages.length - rawTailSize);
          const cutoffId = toSummarize[toSummarize.length - 1]?.id;

          if (cutoffId) {
            const toastId = toast.loading("Compacting context...");

            try {
              const summaryText = await generateConversationSummary(
                toSummarize,
                activeProvider,
                selectedModel.modelId,
                compactionSignal,
              );

              setConversationSummary(conversationId, summaryText, cutoffId);
              persistConversation(conversationId);
              outgoing = buildOutgoingContext(contextMessages, {
                summary: summaryText,
                summarizedUpToId: cutoffId,
              });

              if (import.meta.env.DEV) {
                // eslint-disable-next-line no-console
                console.log(
                  `[personal-agent] compacted context: summarized ${toSummarize.length} messages, kept ${rawTailSize} raw`,
                );
              }
            } catch (error) {
              if (error instanceof DOMException && error.name === "AbortError") {
                setIsGenerating(false);
                abortControllerRef.current = null;
                return;
              }

              compactionFailed = true;

              if (import.meta.env.DEV) {
                // eslint-disable-next-line no-console
                console.error("[personal-agent] compaction failed", error);
              }
            } finally {
              toast.dismiss(toastId);
            }
          }
        }
      }

      if (compactionFailed && outgoing.summaryText === null) {
        const tokens = estimateTokens(contextMessages) + estimateTextTokens(systemPrompt ?? "");
        const contextWindow = getContextWindow(activeProvider.baseUrl, selectedModel.modelId);

        if (shouldCompact(tokens, contextWindow)) {
          toast.error("Conversation too long to send", {
            description: "Compaction failed. Try a shorter message or start a new chat.",
          });
          setIsGenerating(false);
          abortControllerRef.current = null;
          return;
        }

        toast.error("Failed to compact context", {
          description: "Sending full history instead.",
        });
      }

      addMessage(conversationId, assistantMessage);

      const combinedSystemPrompt = outgoing.summaryText
        ? [systemPrompt, `Summary of earlier conversation:\n${outgoing.summaryText}`]
            .filter(Boolean)
            .join("\n\n")
        : systemPrompt;

      logProviderCall({
        providerName: activeProvider.label,
        baseUrl: activeProvider.baseUrl,
        modelId: selectedModel.modelId,
        messageCount: outgoing.messages.length,
      });

      let lastError: unknown = null;

      for (let attempt = 0; attempt <= MAX_STREAM_RETRIES; attempt++) {
        abortControllerRef.current = new AbortController();

        try {
          const fetchImpl = activeProvider.connectionMode === "proxy" ? proxyFetch : undefined;

          const provider = createOpenAICompatible({
            name: activeProvider.name,
            baseURL: activeProvider.baseUrl,
            apiKey: activeProvider.apiKey,
            fetch: fetchImpl,
          });

          const model = provider(selectedModel.modelId);
          const messages = buildCoreMessages(outgoing.messages);
          const tools = isGeminiProvider(activeProvider.baseUrl) ? {} : buildEnabledTools();
          const hasTools = Object.keys(tools).length > 0;

          const { fullStream } = streamText({
            model,
            messages,
            ...(combinedSystemPrompt ? { system: combinedSystemPrompt } : {}),
            ...(hasTools ? { tools, stopWhen: stepCountIs(8) } : {}),
            abortSignal: abortControllerRef.current.signal,
            reasoning:
              thinkingLevel !== "off" ? (THINKING_TO_REASONING[thinkingLevel] ?? "medium") : "none",
          });

          for await (const part of fullStream) {
            if (part.type === "text-delta") {
              appendMessageContent(conversationId, assistantMessage.id, part.text);
            } else if (part.type === "reasoning-delta") {
              appendMessageReasoning(conversationId, assistantMessage.id, part.text);
            } else if (part.type === "error") {
              throw part.error instanceof Error ? part.error : new Error(String(part.error));
            } else if (import.meta.env.DEV) {
              if (part.type === "tool-call") {
                // eslint-disable-next-line no-console
                console.log(`[personal-agent] tool call: ${part.toolName}`, part.input);
              } else if (part.type === "tool-result") {
                // eslint-disable-next-line no-console
                console.log(`[personal-agent] tool result: ${part.toolName}`, part.output);
              } else if (part.type === "tool-error") {
                // eslint-disable-next-line no-console
                console.log(`[personal-agent] tool error: ${part.toolName}`, part.error);
              } else if (part.type === "finish") {
                // eslint-disable-next-line no-console
                console.log(`[personal-agent] stream finished: ${part.finishReason}`);
              }
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
        let message =
          lastError instanceof Error ? lastError.message : "Failed to generate response";
        const isNetworkError =
          lastError instanceof TypeError && lastError.message.includes("fetch");

        if (APICallError.isInstance(lastError)) {
          // eslint-disable-next-line no-console
          console.error("[personal-agent] API call failed", {
            statusCode: lastError.statusCode,
            url: lastError.url,
            responseBody: lastError.responseBody,
          });
          if (lastError.responseBody) {
            message = `${message}: ${truncate(lastError.responseBody, 500)}`;
          }
        }

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
      setConversationSummary,
      persistConversation,
    ],
  );

  const sendMessage = useCallback(
    async (content: string, attachments?: Attachment[]) => {
      if (!activeProvider) {
        return;
      }

      let trimmed = content.trim();
      const hasAttachments = attachments && attachments.length > 0;
      if (!trimmed && !hasAttachments) {
        return;
      }

      // Parse slash commands: /skillname or /agentname at the start of the message
      const agentsState = useAgentsStore.getState();
      let slashActivatedSkillId: string | null = null;
      let slashActivatedAgentId: string | null = null;

      const slashMatch = trimmed.match(/^\/(\S+)(?:\s+(.*))?$/s);
      if (slashMatch) {
        const commandName = slashMatch[1] ?? "";
        const rest = slashMatch[2] ?? "";

        // Check skills
        const matchedSkill = agentsState.skills.find(
          (s) => s.name.toLowerCase() === commandName.toLowerCase(),
        );
        if (matchedSkill) {
          slashActivatedSkillId = matchedSkill.id;
          agentsState.activateSkill(matchedSkill.id);
          trimmed = rest.trim();
        }

        // Check agents
        if (!slashActivatedSkillId) {
          const matchedAgent = agentsState.customAgents.find(
            (a) => a.name.toLowerCase() === commandName.toLowerCase(),
          );
          if (matchedAgent) {
            slashActivatedAgentId = matchedAgent.id;
            agentsState.activateAgent(matchedAgent.id);
            trimmed = rest.trim();
          }
        }
      }

      // If the slash command consumed the entire message, don't send empty
      if (!trimmed && !hasAttachments && (slashActivatedSkillId || slashActivatedAgentId)) {
        // User just typed /skillname with no message - still send an empty message
        // so the skill/agent system prompt is injected
      }

      // Build system prompt from the freshly activated state (not from the useMemo
      // closure, which is stale at this point because activateSkill/activateAgent
      // were called synchronously above and React has not re-rendered yet).
      const freshState = useAgentsStore.getState();
      const activePrompt = systemPromptFromState(freshState);

      const currentConversation = selectSelectedConversation(useChatStore.getState());
      if (!currentConversation) {
        return;
      }

      const userMessage: Message = {
        id: createMessageId(),
        role: "user",
        content: trimmed || "Hello",
        attachments: hasAttachments ? attachments : undefined,
        createdAt: new Date(),
      };

      addMessage(currentConversation.id, userMessage);

      await streamAssistantResponse(
        currentConversation.id,
        [...currentConversation.messages, userMessage],
        activePrompt,
      );

      // One-shot: deactivate skill/agent after response completes
      if (slashActivatedSkillId) {
        useAgentsStore.getState().deactivateSkill();
      }
      if (slashActivatedAgentId) {
        useAgentsStore.getState().deactivateAgent();
      }
    },
    [activeProvider, addMessage, streamAssistantResponse, systemPrompt],
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

    await streamAssistantResponse(
      currentConversation.id,
      currentConversation.messages,
      systemPrompt,
    );
  }, [conversation, activeProvider, regenerateMessage, streamAssistantResponse, systemPrompt]);

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

      await streamAssistantResponse(
        currentConversation.id,
        currentConversation.messages,
        systemPrompt,
      );
    },
    [conversation, activeProvider, editMessageInStore, streamAssistantResponse, systemPrompt],
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
    systemPrompt,
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
