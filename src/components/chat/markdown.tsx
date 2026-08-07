"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { toast } from "sonner";
import { Button } from "#components/ui/button";
import { cn } from "#lib/utils";

interface MarkdownProps {
  children: string;
  className?: string;
}

function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const language = /language-(\w+)/.exec(className ?? "")?.[1];

  const handleCopy = async () => {
    const text = typeof children === "string" ? children : "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="relative group/code my-3 rounded-lg overflow-hidden bg-popover">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/70">
        <span className="text-xs text-muted-foreground font-mono">{language ?? "text"}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Copy code"
          onClick={handleCopy}
          className="opacity-0 group-hover/code:opacity-100 focus-visible:opacity-100 transition-opacity"
        >
          {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm bg-transparent not-prose">
        <code className={cn(className, "font-mono")}>{children}</code>
      </pre>
    </div>
  );
}

function CodeComponent({
  inline,
  className,
  children,
}: React.ComponentProps<"code"> & { inline?: boolean }) {
  if (inline) {
    return <code className="rounded bg-muted px-1 py-0.5 text-sm font-mono">{children}</code>;
  }
  return <CodeBlock className={className}>{children}</CodeBlock>;
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none prose-headings:mt-5 prose-headings:mb-2",
        className,
      )}
    >
      <ReactMarkdown
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre({ children }) {
            return <>{children}</>;
          },
          code: CodeComponent,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
