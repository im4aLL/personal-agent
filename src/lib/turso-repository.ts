import type { Conversation, Message } from "#lib/types/chat";
import { getTursoConfig, tursoExecute, tursoExecuteMany, tursoSelect } from "./turso";

interface TursoConversationRow {
  id: string;
  title: string;
  pinned: number | null;
  tags: string | null;
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
  // Ensure schema_meta exists. SQLite tables always have an implicit rowid column.
  await tursoExecute(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      version INTEGER NOT NULL
    )
  `);

  // Clean up duplicate rows from earlier bug. Keep only the row with the smallest rowid.
  await tursoExecute("DELETE FROM schema_meta WHERE rowid > (SELECT MIN(rowid) FROM schema_meta)");

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

  await tursoExecute(`
    CREATE TABLE IF NOT EXISTS user_instructions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await tursoExecute(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await tursoExecute(`
    CREATE TABLE IF NOT EXISTS custom_agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  const rows = await tursoSelect<{ version: number | null }>("SELECT version FROM schema_meta");
  let version = rows[0]?.version ?? 0;

  if (version === 0) {
    await tursoExecute("INSERT INTO schema_meta (version) VALUES (1)");
    version = 1;
  }

  if (version < 2) {
    await tursoExecute(`
      CREATE TABLE IF NOT EXISTS provider_configs (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        base_url TEXT NOT NULL,
        encrypted_key TEXT NOT NULL,
        connection_mode TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        synced_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await tursoExecute("UPDATE schema_meta SET version = 2");
  }

  if (version < 3) {
    await tursoExecute("ALTER TABLE conversations ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0");
    await tursoExecute("UPDATE schema_meta SET version = 3");
  }

  if (version < 4) {
    await tursoExecute("ALTER TABLE conversations ADD COLUMN tags TEXT DEFAULT '[]'");
    await tursoExecute("UPDATE schema_meta SET version = 4");
  }

  if (version < 5) {
    await tursoExecute("UPDATE schema_meta SET version = 5");
  }
}

export async function loadConversations(): Promise<Conversation[]> {
  const config = getTursoConfig();
  if (!config) return [];

  const convRows = await tursoSelect<TursoConversationRow>(
    "SELECT id, title, pinned, tags, created_at, updated_at FROM conversations ORDER BY updated_at DESC",
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

    let tags: string[] = [];
    if (row.tags) {
      try {
        const parsed = JSON.parse(row.tags);
        if (Array.isArray(parsed) && parsed.every((t) => typeof t === "string")) {
          tags = parsed;
        }
      } catch {
        // Ignore malformed JSON.
      }
    }

    conversations.push({
      id: row.id,
      title: row.title,
      messages,
      pinned: row.pinned === 1,
      tags,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  return conversations;
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  const requests: Array<{ sql: string; args: unknown[] }> = [
    {
      sql: `INSERT OR REPLACE INTO conversations (id, title, pinned, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        conversation.id,
        conversation.title,
        conversation.pinned ? 1 : 0,
        JSON.stringify(conversation.tags ?? []),
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
