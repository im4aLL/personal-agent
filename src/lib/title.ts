import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import type { ProviderInfo } from "#store/chat";
import { proxyFetch } from "./ai";

const TITLE_PROMPT = `Summarize the user's first message into a very short, concise chat title (3-5 words). Respond with only the title text. Do not use quotes, punctuation, or explanations.`;

export async function generateConversationTitle(
  firstUserMessage: string,
  provider: ProviderInfo,
  modelId: string,
): Promise<string> {
  const fetchImpl = provider.connectionMode === "proxy" ? proxyFetch : undefined;

  const aiProvider = createOpenAICompatible({
    name: provider.name,
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey,
    fetch: fetchImpl,
  });

  const model = aiProvider(modelId);

  const { text } = await generateText({
    model,
    messages: [
      { role: "system", content: TITLE_PROMPT },
      { role: "user", content: firstUserMessage },
    ],
  });

  const title = text
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/[.!?]$/, "")
    .trim();

  if (!title) {
    throw new Error("Empty title generated");
  }

  return title;
}
