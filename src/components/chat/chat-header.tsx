"use client";

interface ChatHeaderProps {
  title: string;
}

export function ChatHeader({ title }: ChatHeaderProps) {
  return (
    <header className="flex items-center border-b px-4 py-3">
      <h2 className="truncate text-sm font-semibold">{title}</h2>
    </header>
  );
}
