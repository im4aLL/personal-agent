"use client";

import { ChevronDownIcon, CpuIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#components/ui/dropdown-menu";
import { useChatStore } from "#store/chat";

interface ChatHeaderProps {
  title: string;
}

export function ChatHeader({ title }: ChatHeaderProps) {
  const { providers, selectedModel, setSelectedModel } = useChatStore();

  const selectedProvider = providers.find((provider) => provider.id === selectedModel.providerId);
  const selectedModelName =
    selectedProvider?.models.find((model) => model.id === selectedModel.modelId)?.name ??
    selectedModel.modelId;

  return (
    <header className="flex items-center justify-between border-b px-4 py-3">
      <h2 className="truncate text-sm font-semibold">{title}</h2>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <CpuIcon className="size-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">
            {selectedProvider?.name} / {selectedModelName}
          </span>
          <span className="sm:hidden">{selectedModelName}</span>
          <ChevronDownIcon className="size-3 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuRadioGroup
            value={`${selectedModel.providerId}:${selectedModel.modelId}`}
            onValueChange={(value) => {
              const [providerId, modelId] = value.split(":");
              if (providerId && modelId) {
                setSelectedModel(providerId, modelId);
              }
            }}
          >
            {providers.map((provider, index) => (
              <div key={provider.id}>
                <DropdownMenuLabel>{provider.name}</DropdownMenuLabel>
                {provider.models.map((model) => (
                  <DropdownMenuRadioItem
                    key={`${provider.id}:${model.id}`}
                    value={`${provider.id}:${model.id}`}
                  >
                    {model.name}
                  </DropdownMenuRadioItem>
                ))}
                {index < providers.length - 1 && <DropdownMenuSeparator />}
              </div>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
