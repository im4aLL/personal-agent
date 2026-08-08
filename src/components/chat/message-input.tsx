"use client";

import {
  ArrowUpIcon,
  BrainIcon,
  ChevronDownIcon,
  Loader2Icon,
  PaperclipIcon,
  SearchIcon,
  SquareIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "#components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#components/ui/dropdown-menu";
import { Input } from "#components/ui/input";
import { Textarea } from "#components/ui/textarea";
import { useChat } from "#hooks/use-chat";
import { useChatStore } from "#store/chat";

const MAX_MESSAGE_LENGTH = 50000;

const THINKING_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function ModelSelector() {
  const providers = useChatStore((state) => state.providers);
  const selectedModel = useChatStore((state) => state.selectedModel);
  const setSelectedModel = useChatStore((state) => state.setSelectedModel);
  const refreshProviderModels = useChatStore((state) => state.refreshProviderModels);
  const disabledModels = useChatStore((state) => state.disabledModels);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const options = useMemo(
    () =>
      providers.flatMap((provider) => {
        const enabledModels = provider.models.filter(
          (m) => !disabledModels.has(`${provider.id}:${m.id}`),
        );

        return enabledModels.map((model) => ({
          value: `${provider.id}:${model.id}`,
          label: `${provider.label} / ${model.name}`,
          providerId: provider.id,
          modelId: model.id,
          providerName: provider.label,
        }));
      }),
    [providers, disabledModels],
  );

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const lower = search.toLowerCase();
    return options.filter(
      (option) =>
        option.modelId.toLowerCase().includes(lower) ||
        option.providerName.toLowerCase().includes(lower) ||
        option.label.toLowerCase().includes(lower),
    );
  }, [options, search]);

  const providersNeedingRefresh = useMemo(
    () =>
      providers.filter(
        (provider) =>
          provider.models.length === 0 && !provider.isLoadingModels && !provider.modelsError,
      ),
    [providers],
  );

  const visibleProviders = useMemo(
    () =>
      providers.filter((provider) =>
        filteredOptions.some((option) => option.providerId === provider.id),
      ),
    [providers, filteredOptions],
  );

  const selectedValue = `${selectedModel.providerId}:${selectedModel.modelId}`;
  const selectedLabel =
    options.find((option) => option.value === selectedValue)?.label ?? "Select model";
  const isLoading = providers.some((provider) => provider.isLoadingModels);

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      return;
    }

    for (const provider of providersNeedingRefresh) {
      void refreshProviderModels(provider.id);
    }
  }, [isOpen, providersNeedingRefresh, refreshProviderModels]);

  function handleRetry(providerId: string) {
    void refreshProviderModels(providerId);
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-9 gap-1 px-2 text-xs">
          {isLoading ? <Loader2Icon className="size-3 animate-spin" /> : null}
          {selectedLabel}
          <ChevronDownIcon className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <div className="px-2 py-1.5">
          <div className="relative">
            <SearchIcon className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-7 pl-7 text-xs"
              placeholder="Search models..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  const first = filteredOptions[0];
                  if (first) {
                    setSelectedModel(first.providerId, first.modelId);
                    setIsOpen(false);
                  }
                }
              }}
            />
          </div>
        </div>
        <DropdownMenuSeparator />
        {providers.length === 0 ? (
          <DropdownMenuLabel>No providers configured</DropdownMenuLabel>
        ) : filteredOptions.length === 0 ? (
          <DropdownMenuLabel>No models match your search</DropdownMenuLabel>
        ) : (
          visibleProviders.map((provider, index) => {
            const providerModels = filteredOptions.filter(
              (option) => option.providerId === provider.id,
            );
            const enabledModels = provider.models.filter(
              (m) =>
                !disabledModels.has(`${provider.id}:${m.id}`) &&
                providerModels.some((option) => option.modelId === m.id),
            );
            const hasModels = provider.models.length > 0;
            const hasEnabledModels = enabledModels.length > 0;
            const allDisabled = hasModels && !hasEnabledModels && !provider.isLoadingModels;

            return (
              <DropdownMenuGroup key={provider.id}>
                <DropdownMenuLabel>
                  {provider.label}
                  {allDisabled && (
                    <span className="ml-2 text-xs font-normal text-destructive">All disabled</span>
                  )}
                </DropdownMenuLabel>
                {provider.isLoadingModels && provider.models.length === 0 && (
                  <DropdownMenuItem disabled>
                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                    Loading models...
                  </DropdownMenuItem>
                )}
                {provider.modelsError && (
                  <DropdownMenuItem
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleRetry(provider.id);
                    }}
                  >
                    <Loader2Icon className="mr-2 size-4" />
                    Error: {provider.modelsError}
                  </DropdownMenuItem>
                )}
                {hasEnabledModels && (
                  <DropdownMenuRadioGroup
                    value={selectedValue}
                    onValueChange={(value) => {
                      const option = options.find((item) => item.value === value);
                      if (option) {
                        setSelectedModel(option.providerId, option.modelId);
                      }
                    }}
                  >
                    {enabledModels.map((model) => {
                      const value = `${provider.id}:${model.id}`;
                      return (
                        <DropdownMenuRadioItem key={value} value={value}>
                          {model.name}
                        </DropdownMenuRadioItem>
                      );
                    })}
                  </DropdownMenuRadioGroup>
                )}
                {allDisabled && <DropdownMenuItem disabled>All models disabled</DropdownMenuItem>}
                {provider.models.length === 0 &&
                  !provider.isLoadingModels &&
                  !provider.modelsError && (
                    <DropdownMenuItem disabled>No models found</DropdownMenuItem>
                  )}
                {index < visibleProviders.length - 1 && <DropdownMenuSeparator />}
              </DropdownMenuGroup>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThinkingSelector() {
  const thinkingLevel = useChatStore((state) => state.thinkingLevel);
  const setThinkingLevel = useChatStore((state) => state.setThinkingLevel);

  const selectedLabel = `Thinking / ${THINKING_OPTIONS.find((option) => option.value === thinkingLevel)?.label ?? "Off"}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-9 gap-1 px-2 text-xs">
          <BrainIcon className="size-3.5" />
          {selectedLabel}
          <ChevronDownIcon className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={thinkingLevel}
          onValueChange={(value) => {
            setThinkingLevel(value);
          }}
        >
          {THINKING_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MessageInput() {
  const [value, setValue] = useState("");
  const { sendMessage, stop, isGenerating, canSend, isOffline } = useChat();
  const selectedModel = useChatStore((state) => state.selectedModel);
  const disabledModels = useChatStore((state) => state.disabledModels);
  const providers = useChatStore((state) => state.providers);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeProvider = useMemo(
    () => providers.find((p) => p.id === selectedModel.providerId),
    [providers, selectedModel.providerId],
  );

  const isModelDisabled = disabledModels.has(
    `${selectedModel.providerId}:${selectedModel.modelId}`,
  );

  const placeholder = useMemo(() => {
    if (isOffline) return "You are offline";
    if (!activeProvider) return "Select a provider and model to start chatting";
    if (isModelDisabled) return "Selected model is disabled. Pick another model in Settings.";
    if (!canSend) return "No enabled models for this provider. Enable one in Settings.";
    return "Message...";
  }, [isOffline, activeProvider, isModelDisabled, canSend]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      const target = event.target as HTMLElement;
      const isInTextarea = target === textareaRef.current;
      const isInInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if (isGenerating) {
        event.preventDefault();
        stop();
      } else if (isInTextarea && value.length > 0) {
        event.preventDefault();
        setValue("");
      } else if (!isInInput) {
        return;
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [isGenerating, stop, value]);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || isGenerating || !canSend) return;
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      toast.error("Message too long", {
        description: `Messages are limited to ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.`,
      });
      return;
    }
    setValue("");
    void sendMessage(trimmed);
  }

  function handleStop() {
    stop();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (isGenerating) {
        handleStop();
      } else {
        handleSend();
      }
    }
  }

  function handleAttach() {
    toast("Coming soon", {
      description: "Attachments are not implemented yet.",
    });
  }

  return (
    <div className="border-t bg-background px-4 py-4">
      <div className="relative flex flex-col rounded-2xl border bg-background p-3 dark:bg-transparent">
        <div className="flex items-end gap-2">
          <Textarea
            placeholder={placeholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            ref={textareaRef}
            className="max-h-60 min-h-12 resize-none border-0 bg-transparent px-4 py-3 shadow-none focus-visible:ring-0 dark:bg-transparent"
            disabled={isGenerating}
            maxLength={MAX_MESSAGE_LENGTH}
            aria-label="Message input"
          />
          <div className="p-1.5">
            {isGenerating ? (
              <Button
                type="button"
                size="icon-sm"
                variant="destructive"
                aria-label="Stop generating"
                onClick={handleStop}
              >
                <SquareIcon className="size-4 fill-current" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon-sm"
                aria-label="Send message"
                disabled={!value.trim() || !canSend}
                onClick={handleSend}
              >
                <ArrowUpIcon className="size-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 px-1 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Attach file"
            onClick={handleAttach}
          >
            <PaperclipIcon className="size-4" />
          </Button>
          <ModelSelector />
          <ThinkingSelector />
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        AI can make mistakes. Verify important information.
      </p>
    </div>
  );
}
