import type { Conversation, ConversationSummary, Message } from "#lib/types/chat";
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

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed) && parsed.every((t) => typeof t === "string")) {
      return parsed;
    }
  } catch {
    // Ignore malformed JSON.
  }
  return [];
}

function mapRowToSummary(row: TursoConversationRow): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    pinned: row.pinned === 1,
    tags: parseTags(row.tags),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToMessage(row: TursoMessageRow): Message {
  return {
    id: row.id,
    role: row.role as Message["role"],
    content: row.content,
    reasoning: row.reasoning ? { content: row.reasoning } : undefined,
    status: (row.status as Message["status"]) ?? undefined,
    error: row.error ?? undefined,
    editedAt: row.edited_at ? new Date(row.edited_at) : undefined,
    createdAt: new Date(row.created_at),
    model: row.model_provider_id
      ? {
          providerId: row.model_provider_id,
          providerName: row.model_provider_name ?? "",
          modelId: row.model_id ?? "",
          modelName: row.model_name ?? "",
        }
      : undefined,
    thinkingLevel: row.thinking_level ?? undefined,
  };
}

export async function loadConversations(): Promise<Conversation[]> {
  const config = getTursoConfig();
  if (!config) return [];

  const convRows = await tursoSelect<TursoConversationRow>(
    "SELECT id, title, pinned, tags, created_at, updated_at FROM conversations ORDER BY updated_at DESC",
  );

  const conversations: Conversation[] = [];

  for (const row of convRows) {
    const messages = await loadMessages(row.id);

    conversations.push({
      ...mapRowToSummary(row),
      messages,
    });
  }

  return conversations;
}

export async function loadConversationSummaries(): Promise<{
  pinned: ConversationSummary[];
  today: ConversationSummary[];
  yesterday: ConversationSummary[];
  previous7Days: ConversationSummary[];
  monthGroups: { month: string; label: string; count: number }[];
}> {
  const config = getTursoConfig();
  if (!config) {
    return { pinned: [], today: [], yesterday: [], previous7Days: [], monthGroups: [] };
  }

  const [pinnedRows, todayRows, yesterdayRows, previous7DaysRows, monthRows] = await Promise.all([
    tursoSelect<TursoConversationRow>(
      "SELECT id, title, pinned, tags, created_at, updated_at FROM conversations WHERE pinned = 1 ORDER BY updated_at DESC",
    ),
    tursoSelect<TursoConversationRow>(
      "SELECT id, title, pinned, tags, created_at, updated_at FROM conversations WHERE date(updated_at) = date('now') AND pinned = 0 ORDER BY updated_at DESC",
    ),
    tursoSelect<TursoConversationRow>(
      "SELECT id, title, pinned, tags, created_at, updated_at FROM conversations WHERE date(updated_at) = date('now', '-1 day') AND pinned = 0 ORDER BY updated_at DESC",
    ),
    tursoSelect<TursoConversationRow>(
      "SELECT id, title, pinned, tags, created_at, updated_at FROM conversations WHERE updated_at >= date('now', '-7 days') AND updated_at < date('now', '-1 day') AND pinned = 0 ORDER BY updated_at DESC",
    ),
    tursoSelect<{ month: string; count: number }>(
      "SELECT strftime('%Y-%m', updated_at) as month, COUNT(*) as count FROM conversations WHERE updated_at < date('now', '-7 days') AND pinned = 0 GROUP BY month ORDER BY month DESC",
    ),
  ]);

  const monthGroups = monthRows.map((row) => ({
    month: row.month,
    label: new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long" }).format(
      new Date(`${row.month}-01`),
    ),
    count: row.count,
  }));

  return {
    pinned: pinnedRows.map(mapRowToSummary),
    today: todayRows.map(mapRowToSummary),
    yesterday: yesterdayRows.map(mapRowToSummary),
    previous7Days: previous7DaysRows.map(mapRowToSummary),
    monthGroups,
  };
}

export async function loadConversationsForMonth(
  month: string,
  limit: number,
): Promise<ConversationSummary[]> {
  const config = getTursoConfig();
  if (!config) return [];

  const startDate = `${month}-01`;
  const [year, mon] = month.split("-").map(Number);
  const nextMonth =
    mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, "0")}-01`;

  const rows = await tursoSelect<TursoConversationRow>(
    `SELECT id, title, pinned, tags, created_at, updated_at
     FROM conversations WHERE updated_at >= ? AND updated_at < ? AND pinned = 0
     ORDER BY updated_at DESC LIMIT ?`,
    [startDate, nextMonth, limit],
  );

  return rows.map(mapRowToSummary);
}

export async function loadMessages(conversationId: string): Promise<Message[]> {
  const config = getTursoConfig();
  if (!config) return [];

  const msgRows = await tursoSelect<TursoMessageRow>(
    `SELECT id, conversation_id, role, content, reasoning, status, error, edited_at, created_at,
            model_provider_id, model_provider_name, model_id, model_name, thinking_level
     FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`,
    [conversationId],
  );

  return msgRows.map(mapRowToMessage);
}

export async function saveConversation(
  conversation: ConversationSummary & { messages?: Message[] },
): Promise<void> {
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

  // Only persist messages when they are present and non-empty.
  // An empty or undefined messages array means messages are not loaded yet,
  // so we update only the conversation row without touching messages.
  if (conversation.messages !== undefined && conversation.messages.length > 0) {
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
  const nowIso = message.createdAt.toISOString();

  // Guarantee the parent conversation row exists before inserting, since
  // messages.conversation_id is a foreign key and a brand-new conversation's
  // first message can otherwise be saved before its own conversation row is.
  // A real saveConversation() call (fired on conversation creation) will
  // overwrite these placeholder values shortly after via INSERT OR REPLACE.
  await tursoExecuteMany([
    {
      sql: `INSERT OR IGNORE INTO conversations (id, title, pinned, tags, created_at, updated_at)
            VALUES (?, ?, 0, '[]', ?, ?)`,
      args: [conversationId, "New chat", nowIso, nowIso],
    },
    {
      sql: `INSERT OR REPLACE INTO messages (
        id, conversation_id, role, content, reasoning, status, error, edited_at, created_at,
        model_provider_id, model_provider_name, model_id, model_name, thinking_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        message.id,
        conversationId,
        message.role,
        message.content,
        reasoningValue,
        statusValue,
        errorValue,
        editedAtValue,
        nowIso,
        modelProviderId,
        modelProviderName,
        modelId,
        modelName,
        thinkingLevel,
      ],
    },
  ]);
}

export async function truncateMessages(conversationId: string, messageId: string): Promise<void> {
  await tursoExecuteMany([
    {
      sql: "DELETE FROM messages WHERE conversation_id = ? AND created_at >= (SELECT created_at FROM messages WHERE id = ?)",
      args: [conversationId, messageId],
    },
  ]);
}

export async function searchConversations(query: string): Promise<ConversationSummary[]> {
  const config = getTursoConfig();
  if (!config || !query.trim()) return [];

  const likeQuery = `%${query.trim()}%`;

  const convRows = await tursoSelect<TursoConversationRow>(
    `SELECT id, title, pinned, tags, created_at, updated_at FROM conversations
     WHERE title LIKE ? OR tags LIKE ?
     ORDER BY updated_at DESC`,
    [likeQuery, likeQuery],
  );

  return convRows.map(mapRowToSummary);
}

export async function deleteMessage(messageId: string): Promise<void> {
  await tursoExecute("DELETE FROM messages WHERE id = ?", [messageId]);
}
