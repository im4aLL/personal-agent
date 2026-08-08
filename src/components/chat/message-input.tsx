"use client";

import {
  ArrowUpIcon,
  BotIcon,
  BrainIcon,
  ChevronDownIcon,
  FileTextIcon,
  ImageIcon,
  Loader2Icon,
  PaperclipIcon,
  SparklesIcon,
  SquareIcon,
  XIcon,
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
import { Popover, PopoverContent, PopoverAnchor } from "#components/ui/popover";
import { Textarea } from "#components/ui/textarea";
import { useChat } from "#hooks/use-chat";
import type { Attachment } from "#lib/types/chat";
import { useAgentsStore } from "#store/agents";
import { useChatStore } from "#store/chat";

const MAX_MESSAGE_LENGTH = 50000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

function createAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readFileAsAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve({
        id: createAttachmentId(),
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        data: reader.result as string,
      });
    };

    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));

    if (IMAGE_MIME_TYPES.includes(file.type)) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  });
}

async function blobToAttachment(blob: Blob, name: string): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve({
        id: createAttachmentId(),
        name,
        type: blob.type || "image/png",
        size: blob.size,
        data: reader.result as string,
      });
    };

    reader.onerror = () => reject(new Error("Failed to read pasted image"));
    reader.readAsDataURL(blob);
  });
}

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
        .filter((provider) => filteredOptions.some((option) => option.providerId === provider.id))
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
                  <ComboboxEmpty key={providerId}>Error: {provider.modelsError}</ComboboxEmpty>
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

function SlashCommandAutocomplete({
  open,
  onOpenChange,
  onSelect,
  anchorRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (name: string) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}) {
  const skills = useAgentsStore((s) => s.skills);
  const agents = useAgentsStore((s) => s.customAgents);

  if (skills.length === 0 && agents.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div ref={anchorRef as React.RefObject<HTMLDivElement>} />
      </PopoverAnchor>
      <PopoverContent
        className="w-64 p-1"
        align="start"
        side="top"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-60 overflow-auto">
          {skills.length > 0 && (
            <>
              <div className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                <SparklesIcon className="size-3" />
                Skills
              </div>
              {skills.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => onSelect(skill.name)}
                >
                  <span className="font-medium">/{skill.name}</span>
                  {skill.description && (
                    <span className="truncate text-xs text-muted-foreground">
                      {skill.description}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
          {agents.length > 0 && (
            <>
              {skills.length > 0 && <div className="my-1 border-t" />}
              <div className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                <BotIcon className="size-3" />
                Agents
              </div>
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => onSelect(agent.name)}
                >
                  <span className="font-medium">/{agent.name}</span>
                  {agent.description && (
                    <span className="truncate text-xs text-muted-foreground">
                      {agent.description}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MessageInput() {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [slashOpen, setSlashOpen] = useState(false);
  const { sendMessage, stop, isGenerating, canSend, isOffline } = useChat();
  const selectedModel = useChatStore((state) => state.selectedModel);
  const disabledModels = useChatStore((state) => state.disabledModels);
  const providers = useChatStore((state) => state.providers);
  const activeInstructionId = useAgentsStore((s) => s.activeInstructionId);
  const activeSkillId = useAgentsStore((s) => s.activeSkillId);
  const activeAgentId = useAgentsStore((s) => s.activeAgentId);
  const userInstructions = useAgentsStore((s) => s.userInstructions);
  const skills = useAgentsStore((s) => s.skills);
  const agents = useAgentsStore((s) => s.customAgents);
  const setActiveInstruction = useAgentsStore((s) => s.setActiveInstruction);
  const deactivateSkill = useAgentsStore((s) => s.deactivateSkill);
  const deactivateAgent = useAgentsStore((s) => s.deactivateAgent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slashAnchorRef = useRef<HTMLDivElement>(null);

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

  const activeInstructionName = useMemo(() => {
    if (!activeInstructionId) return null;
    return userInstructions.find((i) => i.id === activeInstructionId)?.name ?? null;
  }, [activeInstructionId, userInstructions]);

  const activeSkillName = useMemo(() => {
    if (!activeSkillId) return null;
    return skills.find((s) => s.id === activeSkillId)?.name ?? null;
  }, [activeSkillId, skills]);

  const activeAgentName = useMemo(() => {
    if (!activeAgentId) return null;
    return agents.find((a) => a.id === activeAgentId)?.name ?? null;
  }, [activeAgentId, agents]);

  const hasActiveItems = activeInstructionName || activeSkillName || activeAgentName;

  // Slash command detection
  const slashQuery = useMemo(() => {
    const match = value.match(/^\/(\S*)$/);
    return match ? match[1] ?? "" : null;
  }, [value]);

  // Show slash autocomplete when user types "/" at the start
  const showSlashAutocomplete = slashQuery !== null && (skills.length > 0 || agents.length > 0);

  function handleSlashSelect(name: string) {
    setValue(`/${name} `);
    setSlashOpen(false);
    textareaRef.current?.focus();
  }

  function handleValueChange(newValue: string) {
    setValue(newValue);
    // Show slash autocomplete when user types / at start
    if (newValue.startsWith("/") && !newValue.includes(" ")) {
      setSlashOpen(true);
    } else {
      setSlashOpen(false);
    }
  }

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
    const hasAttachments = attachments.length > 0;
    if ((!trimmed && !hasAttachments) || isGenerating || !canSend) return;
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      toast.error("Message too long", {
        description: `Messages are limited to ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.`,
      });
      return;
    }
    const currentAttachments = [...attachments];
    setValue("");
    setAttachments([]);
    void sendMessage(trimmed, currentAttachments.length > 0 ? currentAttachments : undefined);
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

  function handleAttachClick() {
    fileInputRef.current?.click();
  }

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: Attachment[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File too large: ${file.name}`, {
          description: `Maximum file size is ${formatFileSize(MAX_FILE_SIZE)}.`,
        });
        continue;
      }

      try {
        const attachment = await readFileAsAttachment(file);
        newAttachments.push(attachment);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to read file";
        toast.error(message);
      }
    }

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        event.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;

        if (blob.size > MAX_FILE_SIZE) {
          toast.error("Pasted image too large", {
            description: `Maximum file size is ${formatFileSize(MAX_FILE_SIZE)}.`,
          });
          continue;
        }

        try {
          const name = `pasted-image.${item.type.split("/")[1] || "png"}`;
          const attachment = await blobToAttachment(blob, name);
          setAttachments((prev) => [...prev, attachment]);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to paste image";
          toast.error(message);
        }
      }
    }
  }

  const hasAttachments = attachments.length > 0;

  return (
    <div className="border-t bg-background px-4 py-4">
      <div className="relative flex flex-col rounded-2xl border bg-background p-3 dark:bg-transparent">
        {hasActiveItems && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-3">
            {activeInstructionName && (
              <div className="inline-flex items-center gap-1 rounded-full border bg-accent/50 px-2.5 py-0.5 text-xs">
                <span className="text-muted-foreground">Instruction:</span>
                <span className="font-medium">{activeInstructionName}</span>
                <button
                  type="button"
                  className="ml-0.5 rounded-full hover:bg-accent"
                  aria-label={`Deactivate instruction ${activeInstructionName}`}
                  onClick={() => setActiveInstruction(null)}
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            )}
            {activeSkillName && (
              <div className="inline-flex items-center gap-1 rounded-full border bg-accent/50 px-2.5 py-0.5 text-xs">
                <SparklesIcon className="size-3 text-muted-foreground" />
                <span className="text-muted-foreground">Skill:</span>
                <span className="font-medium">{activeSkillName}</span>
                <button
                  type="button"
                  className="ml-0.5 rounded-full hover:bg-accent"
                  aria-label={`Deactivate skill ${activeSkillName}`}
                  onClick={() => deactivateSkill()}
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            )}
            {activeAgentName && (
              <div className="inline-flex items-center gap-1 rounded-full border bg-accent/50 px-2.5 py-0.5 text-xs">
                <BotIcon className="size-3 text-muted-foreground" />
                <span className="text-muted-foreground">Agent:</span>
                <span className="font-medium">{activeAgentName}</span>
                <button
                  type="button"
                  className="ml-0.5 rounded-full hover:bg-accent"
                  aria-label={`Deactivate agent ${activeAgentName}`}
                  onClick={() => deactivateAgent()}
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            )}
          </div>
        )}
        {hasAttachments && (
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="group/attachment relative flex items-center gap-3 rounded-lg border bg-muted/50 py-2 pl-3 pr-8 text-xs"
              >
                {IMAGE_MIME_TYPES.includes(attachment.type) && attachment.data ? (
                  <img
                    src={attachment.data}
                    alt={attachment.name}
                    className="size-10 rounded object-cover"
                  />
                ) : (
                  <div className="flex size-10 items-center justify-center rounded bg-muted">
                    {attachment.type.startsWith("image/") ? (
                      <ImageIcon className="size-5 text-muted-foreground" />
                    ) : (
                      <FileTextIcon className="size-5 text-muted-foreground" />
                    )}
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="max-w-36 truncate font-medium">{attachment.name}</span>
                  <span className="text-muted-foreground">{formatFileSize(attachment.size)}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute right-1 top-1 size-5 rounded-full opacity-0 group-hover/attachment:opacity-100"
                  aria-label={`Remove ${attachment.name}`}
                  onClick={() => removeAttachment(attachment.id)}
                >
                  <XIcon className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            placeholder={placeholder}
            value={value}
            onChange={(event) => handleValueChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            rows={1}
            ref={textareaRef}
            className="max-h-60 min-h-12 resize-none border-0 bg-transparent px-4 py-3 shadow-none focus-visible:ring-0 dark:bg-transparent"
            disabled={isGenerating}
            maxLength={MAX_MESSAGE_LENGTH}
            aria-label="Message input"
          />
          <div ref={slashAnchorRef} className="absolute left-4 top-3" />
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
                disabled={(!value.trim() && !hasAttachments) || !canSend}
                onClick={handleSend}
              >
                <ArrowUpIcon className="size-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 px-1 pt-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
            accept="image/*,.txt,.csv,.json,.xml,.html,.css,.js,.ts,.tsx,.jsx,.md,.yaml,.yml,.toml,.ini,.cfg,.log,.env"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Attach file"
            onClick={handleAttachClick}
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
      <SlashCommandAutocomplete
        open={slashOpen && showSlashAutocomplete}
        onOpenChange={setSlashOpen}
        onSelect={handleSlashSelect}
        anchorRef={slashAnchorRef}
      />
    </div>
  );
}
