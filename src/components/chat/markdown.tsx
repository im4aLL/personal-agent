"use client";

import { CheckIcon, CopyIcon, DownloadIcon, ExternalLinkIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
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

function nodeToText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join("");
  if (typeof node === "object" && "props" in node) {
    return nodeToText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

const LANGUAGE_RE = /language-([\w+-]+)/;

function CodeBlock({ children, className }: { children: ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const language = LANGUAGE_RE.exec(className ?? "")?.[1];

  const handleCopy = async () => {
    const text = nodeToText(children);
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
    <div className="relative group/code my-3 max-w-full rounded-lg overflow-hidden bg-popover">
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
      <pre className="max-w-full overflow-x-auto p-4 text-sm bg-transparent not-prose">
        <code className={cn(className, "font-mono")}>{children}</code>
      </pre>
    </div>
  );
}

const FILE_EXTENSIONS =
  /\.(pdf|zip|gz|tar|xz|7z|rar|docx?|xlsx?|pptx?|epub|mp[34]|mov|avi|mkv|wav|flac)$/i;

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
  className,
  children,
}: React.ComponentProps<"code"> & { inline?: boolean; node?: unknown }) {
  const language = LANGUAGE_RE.exec(className ?? "")?.[1];
  const text = nodeToText(children);
  const isBlock = Boolean(language) || text.includes("\n");

  if (!isBlock) {
    return (
      <code className="rounded bg-muted px-1 py-0.5 text-[0.875em] font-mono">{children}</code>
    );
  }

  return <CodeBlock className={className}>{children}</CodeBlock>;
}

const TREE_CHAR_RE = /[├└│─]/;
const ASCII_TREE_RE = /^\s*[|+\\`]+[|\s]*--/;
const FENCE_RE = /^(```|~~~)/;
const MAX_TREE_ROOT_LEN = 120;
const MAX_JSON_LOOKAHEAD = 200;

function isTreeLine(line: string): boolean {
  if (!line.trim()) return false;
  if (TREE_CHAR_RE.test(line)) return true;
  return ASCII_TREE_RE.test(line);
}

function isFenceLine(line: string): boolean {
  return FENCE_RE.test(line.trim());
}

function isTreeRootLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.includes(" ") || trimmed.length > MAX_TREE_ROOT_LEN) return false;
  return /\/$/.test(trimmed);
}

/**
 * Wrap unfenced plaintext directory trees and bare JSON blocks in fenced code
 * blocks so markdown rendering preserves line breaks and indentation instead
 * of collapsing them into a single paragraph.
 */
export function fenceUnfencedBlocks(input: string): string {
  const lines = input.split("\n");
  const out: string[] = [];
  let inFence = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (isFenceLine(line)) {
      inFence = !inFence;
      out.push(line);
      i += 1;
      continue;
    }

    if (inFence) {
      out.push(line);
      i += 1;
      continue;
    }

    const trimmed = line.trim();

    // Bare JSON object/array starting on its own line.
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      let foundEnd = -1;
      let candidate = "";
      let balance = 0;
      const maxLookahead = Math.min(lines.length, i + MAX_JSON_LOOKAHEAD);
      for (let j = i; j < maxLookahead; j += 1) {
        const currentLine = lines[j] ?? "";
        candidate += (j > i ? "\n" : "") + currentLine;
        for (const ch of currentLine) {
          if (ch === "{" || ch === "[") balance += 1;
          else if (ch === "}" || ch === "]") balance -= 1;
        }
        // Strict JSON is deliberate: JSONC/trailing commas/comments intentionally left unfenced.
        try {
          JSON.parse(candidate);
          foundEnd = j;
          break;
        } catch {
          // Keep growing the candidate while it could still become valid JSON.
        }
        if (balance < 0) break;
        const next = (lines[j + 1] ?? "").trim();
        // Stop growing when the next line clearly starts new prose.
        if (next === "" && j + 1 < maxLookahead) {
          const afterBlank = (lines[j + 2] ?? "").trim();
          if (afterBlank !== "" && !/^["\d{[\]}tfn-]/.test(afterBlank)) break;
        }
        if (/^(#{1,6}\s|> |-{1,}\s|\*{1,}\s|\d+\.\s)/.test(next)) break;
      }
      if (foundEnd > i) {
        out.push("```json", ...lines.slice(i, foundEnd + 1), "```");
        i = foundEnd + 1;
        continue;
      }
      if (foundEnd === i) {
        out.push("```json", line, "```");
        i += 1;
        continue;
      }
    }

    // Directory tree: optional `name/` root line followed by tree-drawing lines.
    const nextIsTree = isTreeLine(lines[i + 1] ?? "");
    if (isTreeLine(line) || (isTreeRootLine(line) && nextIsTree)) {
      const run: string[] = [];
      let j = i;
      if (isTreeRootLine(line) && !isTreeLine(line)) {
        run.push(line);
        j += 1;
      }
      while (j < lines.length) {
        const current = lines[j] ?? "";
        if (isFenceLine(current)) break;
        if (!isTreeLine(current)) break;
        run.push(current);
        j += 1;
      }
      if (run.length >= 2) {
        out.push("```text", ...run, "```");
        i = j;
        continue;
      }
    }

    out.push(line);
    i += 1;
  }

  return out.join("\n");
}

interface MdastNode {
  type: string;
  value?: string;
  children?: MdastNode[];
}

function splitSoftBreaks(node: MdastNode): MdastNode[] {
  const value = node.value ?? "";
  if (!value.includes("\n")) return [node];
  const parts = value.split("\n");
  while (parts.length > 1 && (parts[0] ?? "").trim() === "") parts.shift();
  while (parts.length > 1 && (parts[parts.length - 1] ?? "").trim() === "") parts.pop();
  const result: MdastNode[] = [];
  for (const [index, part] of parts.entries()) {
    if (index > 0) result.push({ type: "break" });
    if (index > 0 && index < parts.length - 1 && part.trim() === "") continue;
    result.push({ type: "text", value: part });
  }
  return result;
}

function transformParagraphInlines(node: MdastNode): void {
  if (node.type === "code" || node.type === "inlineCode" || node.type === "html") return;
  const children = node.children;
  if (!children) return;
  const next: MdastNode[] = [];
  for (const child of children) {
    if (child.type === "text") {
      next.push(...splitSoftBreaks(child));
    } else {
      transformParagraphInlines(child);
      next.push(child);
    }
  }
  node.children = next;
}

function transformSoftBreaks(node: MdastNode): void {
  // Chat treats a newline in top-level prose as a line break (Slack-like); structured markdown keeps CommonMark behavior.
  const children = node.children;
  if (!children) return;
  for (const child of children) {
    if (child.type !== "paragraph") continue;
    transformParagraphInlines(child);
  }
}

/**
 * Turn single newlines in normal prose into hard line breaks so plaintext LLM
 * output keeps its line structure instead of collapsing into one paragraph.
 * Unlike CSS `white-space: pre-wrap`, this adds no phantom empty lines from
 * trailing newlines and leaves normal paragraph spacing untouched.
 */
export function remarkSoftBreaks() {
  return (tree: MdastNode) => {
    transformSoftBreaks(tree);
  };
}

export function Markdown({ children, className }: MarkdownProps) {
  const formatted = useMemo(() => fenceUnfencedBlocks(children), [children]);
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none break-words prose-headings:mt-5 prose-headings:mb-2 prose-hr:my-2",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkSoftBreaks]}
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
        {formatted}
      </ReactMarkdown>
    </div>
  );
}
