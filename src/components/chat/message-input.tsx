"use client";

import {
  ArrowUpIcon,
  BrainIcon,
  ChevronDownIcon,
  Loader2Icon,
  PaperclipIcon,
  SquareIcon,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "#components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
} from "#components/ui/combobox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "#components/ui/dropdown-menu";
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
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

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

  const providersNeedingRefresh = useMemo(
    () =>
      providers.filter(
        (provider) =>
          provider.models.length === 0 && !provider.isLoadingModels && !provider.modelsError,
      ),
    [providers],
  );

  const selectedValue = `${selectedModel.providerId}:${selectedModel.modelId}`;
  const selectedLabel =
    options.find((option) => option.value === selectedValue)?.label ?? "Select model";
  const isLoading = providers.some((provider) => provider.isLoadingModels);

  const filteredOptions = useMemo(() => {
    if (!inputValue.trim()) return options;
    const lower = inputValue.toLowerCase();
    return options.filter(
      (option) =>
        option.modelId.toLowerCase().includes(lower) ||
        option.providerName.toLowerCase().includes(lower) ||
        option.label.toLowerCase().includes(lower),
    );
  }, [options, inputValue]);

  // Provider IDs that have at least one enabled model
  const visibleProviderIds = useMemo(
    () =>
      providers
        .filter((provider) =>
          filteredOptions.some((option) => option.providerId === provider.id),
        )
        .map((provider) => provider.id),
    [providers, filteredOptions],
  );

  useEffect(() => {
    if (!open) {
      setInputValue("");
      return;
    }

    for (const provider of providersNeedingRefresh) {
      void refreshProviderModels(provider.id);
    }
  }, [open, providersNeedingRefresh, refreshProviderModels]);

  return (
    <Combobox
      value={selectedValue}
      onValueChange={(value) => {
        const option = options.find((o) => o.value === value);
        if (option) {
          setSelectedModel(option.providerId, option.modelId);
        }
      }}
      filter={() => true}
      autoHighlight={false}
      open={open}
      onOpenChange={setOpen}
      onInputValueChange={setInputValue}
    >
      <ComboboxTrigger
        render={
          <Button type="button" variant="ghost" size="sm" className="h-9 gap-1 px-2 text-xs">
            {isLoading ? <Loader2Icon className="size-3 animate-spin" /> : null}
            {selectedLabel}
            <ChevronDownIcon className="size-3 text-muted-foreground" />
          </Button>
        }
      />
      <ComboboxContent>
        <ComboboxInput showTrigger={false} placeholder="Search models..." />
        <ComboboxList>
          {providers.length === 0 ? (
            <ComboboxEmpty>No providers configured</ComboboxEmpty>
          ) : (
            visibleProviderIds.map((providerId, index) => {
              const provider = providers.find((p) => p.id === providerId);
              if (!provider) return null;
              const providerOptions = filteredOptions.filter(
                (option) => option.providerId === providerId,
              );

              if (provider.isLoadingModels && provider.models.length === 0) {
                return (
                  <ComboboxEmpty key={providerId}>
                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                    Loading models...
                  </ComboboxEmpty>
                );
              }

              if (provider.modelsError) {
                return (
                  <ComboboxEmpty key={providerId}>
                    Error: {provider.modelsError}
                  </ComboboxEmpty>
                );
              }

              return (
                <Fragment key={providerId}>
                  <ComboboxGroup>
                    <ComboboxLabel>{provider.label}</ComboboxLabel>
                    {providerOptions.map((option) => (
                      <ComboboxItem key={option.value} value={option.value}>
                        {option.modelId}
                      </ComboboxItem>
                    ))}
                  </ComboboxGroup>
                  {index < visibleProviderIds.length - 1 && <ComboboxSeparator />}
                </Fragment>
              );
            })
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
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
