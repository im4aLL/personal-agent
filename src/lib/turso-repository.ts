import type { Conversation, Message } from "#lib/types/chat";
import { getTursoConfig, tursoExecute, tursoExecuteMany, tursoSelect } from "./turso";

interface TursoConversationRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface TursoMessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  reasoning: string | null;
  status: string | null;
  error: string | null;
  edited_at: string | null;
  created_at: string;
  model_provider_id: string | null;
  model_provider_name: string | null;
  model_id: string | null;
  model_name: string | null;
  thinking_level: string | null;
}

export async function runMigrations(): Promise<void> {
  await tursoExecute(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      version INTEGER NOT NULL
    )
  `);

  await tursoExecute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await tursoExecute(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      reasoning TEXT,
      status TEXT,
      error TEXT,
      edited_at TEXT,
      created_at TEXT NOT NULL,
      model_provider_id TEXT,
      model_provider_name TEXT,
      model_id TEXT,
      model_name TEXT,
      thinking_level TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `);

  const rows = await tursoSelect<{ version: number }>(
    "SELECT MAX(version) as version FROM schema_meta",
  );

  if (!rows[0] || rows[0].version === null) {
    await tursoExecute("INSERT INTO schema_meta (version) VALUES (1)");
  }
}

export async function loadConversations(): Promise<Conversation[]> {
  const config = getTursoConfig();
  if (!config) return [];

  const convRows = await tursoSelect<TursoConversationRow>(
    "SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC",
  );

  const conversations: Conversation[] = [];

  for (const row of convRows) {
    const msgRows = await tursoSelect<TursoMessageRow>(
      "SELECT id, conversation_id, role, content, reasoning, status, error, edited_at, created_at, model_provider_id, model_provider_name, model_id, model_name, thinking_level FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
      [row.id],
    );

    const messages: Message[] = msgRows.map((m) => ({
      id: m.id,
      role: m.role as Message["role"],
      content: m.content,
      reasoning: m.reasoning ? { content: m.reasoning } : undefined,
      status: (m.status as Message["status"]) ?? undefined,
      error: m.error ?? undefined,
      editedAt: m.edited_at ? new Date(m.edited_at) : undefined,
      createdAt: new Date(m.created_at),
      model: m.model_provider_id
        ? {
            providerId: m.model_provider_id,
            providerName: m.model_provider_name ?? "",
            modelId: m.model_id ?? "",
            modelName: m.model_name ?? "",
          }
        : undefined,
      thinkingLevel: m.thinking_level ?? undefined,
    }));

    conversations.push({
      id: row.id,
      title: row.title,
      messages,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  return conversations;
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  const requests: Array<{ sql: string; args: unknown[] }> = [
    {
      sql: `INSERT OR REPLACE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      args: [
        conversation.id,
        conversation.title,
        conversation.createdAt.toISOString(),
        conversation.updatedAt.toISOString(),
      ],
    },
  ];

  for (const message of conversation.messages) {
    const reasoningValue = message.reasoning?.content ?? null;
    const statusValue = message.status ?? null;
    const errorValue = message.error ?? null;
    const editedAtValue = message.editedAt?.toISOString() ?? null;
    const modelProviderId = message.model?.providerId ?? null;
    const modelProviderName = message.model?.providerName ?? null;
    const modelId = message.model?.modelId ?? null;
    const modelName = message.model?.modelName ?? null;
    const thinkingLevel = message.thinkingLevel ?? null;

    requests.push({
      sql: `INSERT OR REPLACE INTO messages (
        id, conversation_id, role, content, reasoning, status, error, edited_at, created_at,
        model_provider_id, model_provider_name, model_id, model_name, thinking_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        message.id,
        conversation.id,
        message.role,
        message.content,
        reasoningValue,
        statusValue,
        errorValue,
        editedAtValue,
        message.createdAt.toISOString(),
        modelProviderId,
        modelProviderName,
        modelId,
        modelName,
        thinkingLevel,
      ],
    });
  }

  await tursoExecuteMany(requests);
}

export async function deleteConversation(id: string): Promise<void> {
  await tursoExecuteMany([
    { sql: "DELETE FROM messages WHERE conversation_id = ?", args: [id] },
    { sql: "DELETE FROM conversations WHERE id = ?", args: [id] },
  ]);
}

export async function saveMessage(conversationId: string, message: Message): Promise<void> {
  const reasoningValue = message.reasoning?.content ?? null;
  const statusValue = message.status ?? null;
  const errorValue = message.error ?? null;
  const editedAtValue = message.editedAt?.toISOString() ?? null;
  const modelProviderId = message.model?.providerId ?? null;
  const modelProviderName = message.model?.providerName ?? null;
  const modelId = message.model?.modelId ?? null;
  const modelName = message.model?.modelName ?? null;
  const thinkingLevel = message.thinkingLevel ?? null;

  await tursoExecute(
    `INSERT OR REPLACE INTO messages (
      id, conversation_id, role, content, reasoning, status, error, edited_at, created_at,
      model_provider_id, model_provider_name, model_id, model_name, thinking_level
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      conversationId,
      message.role,
      message.content,
      reasoningValue,
      statusValue,
      errorValue,
      editedAtValue,
      message.createdAt.toISOString(),
      modelProviderId,
      modelProviderName,
      modelId,
      modelName,
      thinkingLevel,
    ],
  );
}

export async function truncateMessages(conversationId: string, messageId: string): Promise<void> {
  await tursoExecuteMany([
    {
      sql: "DELETE FROM messages WHERE conversation_id = ? AND created_at >= (SELECT created_at FROM messages WHERE id = ?)",
      args: [conversationId, messageId],
    },
  ]);
}

export async function deleteMessage(messageId: string): Promise<void> {
  await tursoExecute("DELETE FROM messages WHERE id = ?", [messageId]);
}
