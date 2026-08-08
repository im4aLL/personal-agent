type TursoArg = { type: "text" | "integer" | "real" | "null"; value?: string };
type TursoColValue = null | { type: "text" | "integer" | "real" | "null"; value?: string };

interface TursoResultRow {
  cols: { name: string }[];
  rows: TursoColValue[][];
}

interface TursoExecuteResponse {
  type: string;
  response?: {
    type: string;
    result?: TursoResultRow;
  };
  error?: { message: string };
}

interface TursoPipelineResponse {
  results: TursoExecuteResponse[];
}

export function toArg(val: unknown): TursoArg {
  if (val === null || val === undefined) return { type: "null" };
  if (typeof val === "number")
    return { type: Number.isInteger(val) ? "integer" : "real", value: String(val) };
  return { type: "text", value: String(val) };
}

export function parseValue(val: TursoColValue): string | number | null {
  if (val === null || val.type === "null") return null;
  if (val.type === "integer") return Number.parseInt(val.value ?? "0", 10);
  if (val.type === "real") return Number.parseFloat(val.value ?? "0");
  return val.value ?? null;
}

export function getTursoConfig(): { url: string; token: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const rawUrl = window.localStorage.getItem("personal-agent:turso-url");
    const token = window.localStorage.getItem("personal-agent:turso-token");
    if (!rawUrl || !token) return null;
    const url = rawUrl.startsWith("libsql://")
      ? `https://${rawUrl.slice("libsql://".length)}`
      : rawUrl;
    return { url, token };
  } catch {
    return null;
  }
}

async function pipeline(sql: string, args: TursoArg[] = []): Promise<TursoResultRow> {
  const config = getTursoConfig();
  if (!config) throw new Error("Turso not configured");

  const body = JSON.stringify({
    requests: [{ type: "execute", stmt: { sql, args } }, { type: "close" }],
  });

  const response = await fetch(`${config.url}/v2/pipeline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body,
  });

  if (!response.ok) throw new Error(`Turso pipeline failed: HTTP ${response.status}`);

  const data = (await response.json()) as TursoPipelineResponse;
  const first = data.results?.[0];

  if (first?.type === "error") {
    throw new Error(first.error?.message ?? "Turso pipeline error");
  }

  return first?.response?.result ?? { cols: [], rows: [] };
}

export async function tursoExecute(sql: string, args: unknown[] = []): Promise<void> {
  await pipeline(sql, args.map(toArg));
}

export async function tursoSelect<T>(sql: string, args: unknown[] = []): Promise<T[]> {
  const result = await pipeline(sql, args.map(toArg));
  const cols = result.cols;
  const rows = result.rows;

  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < cols.length; i++) {
      obj[cols[i]?.name ?? `col_${i}`] = parseValue(row[i] ?? null);
    }
    return obj as T;
  });
}

export async function tursoExecuteMany(
  requests: Array<{ sql: string; args: unknown[] }>,
): Promise<void> {
  const config = getTursoConfig();
  if (!config) throw new Error("Turso not configured");

  const body = JSON.stringify({
    requests: [
      ...requests.map((r) => ({
        type: "execute",
        stmt: { sql: r.sql, args: r.args.map(toArg) },
      })),
      { type: "close" },
    ],
  });

  const response = await fetch(`${config.url}/v2/pipeline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body,
  });

  if (!response.ok) throw new Error(`Turso pipeline failed: HTTP ${response.status}`);

  const data = (await response.json()) as TursoPipelineResponse;

  for (const result of data.results ?? []) {
    if (result.type === "error") {
      throw new Error(result.error?.message ?? "Turso pipeline error");
    }
  }
}
