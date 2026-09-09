import { invoke } from "@tauri-apps/api/core";
import { tool } from "ai";
import { z } from "zod";
import { downloadBytes, sanitizeFilename } from "#lib/download";

const MAX_CONTENT_CHARS = 100_000;

export function createPdfTool() {
  return tool({
    description:
      "Create a PDF document from a title and text content, then ask the user where " +
      "to save it via a save dialog. Use this when the user asks for a PDF, report, " +
      "handout, or downloadable document version of an answer. Content is plain text " +
      "with light markdown: '# ' for headings, '## ' for subheadings, '- ' for bullet " +
      "points, '1. ' for numbered items, and blank lines to separate paragraphs. " +
      "The tool returns whether the file was saved or the user cancelled the dialog.",
    inputSchema: z.object({
      filename: z.string().describe("Desired file name without extension, e.g. 'weekly-report'"),
      title: z.string().describe("Document title shown at the top of the first page"),
      content: z
        .string()
        .describe("Document body as plain text with light markdown (see tool description)"),
    }),
    execute: async ({ filename, title, content }) => {
      if (!content.trim()) {
        return { error: "Content must not be empty." };
      }
      if (content.length > MAX_CONTENT_CHARS) {
        return {
          error: `Content is too long (${content.length} characters, limit ${MAX_CONTENT_CHARS}). Ask the user to shorten it or split it into parts.`,
        };
      }

      let base64: string;
      try {
        base64 = await invoke<string>("create_pdf", { title, content });
      } catch (error) {
        return { error: `Failed to create PDF: ${toErrorMessage(error)}` };
      }

      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      } catch {
        return { error: "Failed to decode the generated PDF." };
      }

      const safeName = sanitizeFilename(filename).replace(/\.pdf$/i, "") || "untitled";
      const saved = await downloadBytes(bytes, safeName, "application/pdf");
      if (!saved) {
        return { cancelled: true, message: "The user cancelled the save dialog." };
      }
      return { saved: true, filename: `${safeName}.pdf` };
    },
  });
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
