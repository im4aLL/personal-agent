"use client";

import { ArrowUpIcon, BrainIcon, ChevronDownIcon, PaperclipIcon, SquareIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "#components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "#components/ui/dropdown-menu";
import { Textarea } from "#components/ui/textarea";
import { useChatStore } from "#store/chat";

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

  const options = useMemo(
    () =>
      providers.flatMap((provider) =>
        provider.models.map((model) => ({
          value: `${provider.id}:${model.id}`,
          label: `${provider.label} / ${model.name}`,
          providerId: provider.id,
          modelId: model.id,
        })),
      ),
    [providers],
  );

  const selectedValue = `${selectedModel.providerId}:${selectedModel.modelId}`;
  const selectedLabel =
    options.find((option) => option.value === selectedValue)?.label ?? "Select model";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-9 gap-1 px-2 text-xs">
          {selectedLabel}
          <ChevronDownIcon className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuRadioGroup
          value={selectedValue}
          onValueChange={(value) => {
            const option = options.find((item) => item.value === value);
            if (option) {
              setSelectedModel(option.providerId, option.modelId);
            }
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThinkingSelector() {
  const [mode, setMode] = useState("off");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-9 gap-1 px-2 text-xs">
          <BrainIcon className="size-3.5" />
          Thinking
          <ChevronDownIcon className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => {
            setMode(value);
            if (value !== "off") {
              toast("Coming soon", {
                description: "Thinking mode is not implemented yet.",
              });
            }
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
  const [isGenerating, setIsGenerating] = useState(false);

  function handleSend() {
    if (!value.trim()) return;
    setIsGenerating(true);
    toast("Coming soon", {
      description: "Send is not implemented yet.",
    });
  }

  function handleStop() {
    setIsGenerating(false);
    toast("Coming soon", {
      description: "Stop generation is not implemented yet.",
    });
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
            placeholder="Message..."
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="max-h-60 min-h-12 resize-none border-0 bg-transparent px-4 py-3 shadow-none focus-visible:ring-0 dark:bg-transparent"
            disabled={isGenerating}
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
                disabled={!value.trim()}
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
