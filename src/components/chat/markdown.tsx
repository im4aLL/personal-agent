"use client";

import { CheckIcon, CopyIcon, DownloadIcon, ExternalLinkIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Button } from "#components/ui/button";
import { downloadImage, downloadViaProxy, sanitizeFilename } from "#lib/download";
import { cn } from "#lib/utils";

interface MarkdownProps {
  children: string;
  className?: string;
}

function CodeBlock({ children, className }: { children: ReactNode; className?: string }) {
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

const FILE_EXTENSIONS = /\.(pdf|zip|gz|tar|xz|7z|rar|docx?|xlsx?|pptx?|epub|mp[34]|mov|avi|mkv|wav|flac)$/i;

function ImageWithDownload({ src, alt }: { src?: string; alt?: string }) {
  const handleDownload = async () => {
    if (!src) return;

    const baseName = sanitizeFilename(alt ?? "image");

    try {
      const saved = await downloadImage(src, baseName);
      if (saved) {
        toast.success("Image saved");
      }
    } catch {
      toast.error("Failed to download image");
    }
  };

  return (
    <span className="inline-block relative group/img my-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="max-w-full rounded-lg" />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Download image"
        onClick={handleDownload}
        className="absolute top-2 right-2 z-10 opacity-0 group-hover/img:opacity-100 focus-visible:opacity-100 transition-opacity bg-background/80 hover:bg-background"
      >
        <DownloadIcon className="size-3" />
      </Button>
    </span>
  );
}

function LinkRenderer({ href, children }: { href?: string; children?: ReactNode }) {
  const handleClick = async (event: React.MouseEvent) => {
    if (!href) return;

    event.preventDefault();
    event.stopPropagation();

    if (FILE_EXTENSIONS.test(href)) {
      try {
        const urlParts = href.split("/");
        const rawName = urlParts[urlParts.length - 1] ?? "download";
        const saved = await downloadViaProxy(href, decodeURIComponent(rawName));
        if (saved) {
          toast.success("File saved");
        }
      } catch {
        toast.error("Failed to download file");
      }
      return;
    }

    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(href);
    } catch {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="inline-flex items-center gap-0.5 text-primary underline underline-offset-2 hover:opacity-80 cursor-pointer"
    >
      {children}
      <ExternalLinkIcon className="inline size-3 shrink-0" />
    </a>
  );
}

function CodeComponent({
  inline,
  className,
  children,
}: React.ComponentProps<"code"> & { inline?: boolean }) {
  const language = /language-(\w+)/.exec(className ?? "")?.[1];

  if (inline || !language || language === "text") {
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
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre({ children }) {
            return <>{children}</>;
          },
          code: CodeComponent,
          img: ImageWithDownload,
          a: LinkRenderer,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
