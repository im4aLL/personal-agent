"use client";

import { AlignCenterIcon, MonitorIcon, MoonIcon, StretchHorizontalIcon, SunIcon } from "lucide-react";
import { useChatWidth } from "#components/chat-width-provider";
import { useTheme } from "#components/theme-provider";
import { Button } from "#components/ui/button";
import { cn } from "#lib/utils";

type ThemeOption = {
  value: "light" | "dark" | "system";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const THEME_OPTIONS: ThemeOption[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

type ChatWidthOption = {
  value: boolean;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const CHAT_WIDTH_OPTIONS: ChatWidthOption[] = [
  { value: false, label: "Fluid", icon: StretchHorizontalIcon },
  { value: true, label: "Fixed", icon: AlignCenterIcon },
];

export function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const { fixedWidth, setFixedWidth } = useChatWidth();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-medium">Theme</h3>
          <p className="text-sm text-muted-foreground">Choose the appearance for the interface.</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              type="button"
              variant="outline"
              className={cn(
                "flex h-auto flex-col items-center justify-center gap-2 py-4 transition-colors",
                theme === value && "border-primary bg-primary/5 ring-1 ring-primary",
              )}
              onClick={() => setTheme(value)}
              aria-pressed={theme === value}
            >
              <Icon className={cn("size-5", theme === value && "text-primary")} />
              <span className="text-sm font-medium">{label}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-base font-medium">Chat width</h3>
          <p className="text-sm text-muted-foreground">
            Fluid fills the available width. Fixed centers the conversation in a narrower column.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {CHAT_WIDTH_OPTIONS.map(({ value, label, icon: Icon }) => (
            <Button
              key={label}
              type="button"
              variant="outline"
              className={cn(
                "flex h-auto flex-col items-center justify-center gap-2 py-4 transition-colors",
                fixedWidth === value && "border-primary bg-primary/5 ring-1 ring-primary",
              )}
              onClick={() => setFixedWidth(value)}
              aria-pressed={fixedWidth === value}
            >
              <Icon className={cn("size-5", fixedWidth === value && "text-primary")} />
              <span className="text-sm font-medium">{label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
