import type { CustomAgent, Skill, UserInstruction } from "#lib/types/chat";
import { getTursoConfig, tursoExecute, tursoExecuteMany, tursoSelect } from "./turso";

interface TursoUserInstructionRow {
  id: string;
  name: string;
  content: string;
  is_active: number | null;
  created_at: string;
  updated_at: string;
}

interface TursoSkillRow {
  id: string;
  name: string;
  description: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface TursoCustomAgentRow {
  id: string;
  name: string;
  description: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// ─── User Instructions ───────────────────────────────────────────

export async function loadUserInstructions(): Promise<UserInstruction[]> {
  if (!getTursoConfig()) return [];

  const rows = await tursoSelect<TursoUserInstructionRow>(
    "SELECT id, name, content, is_active, created_at, updated_at FROM user_instructions ORDER BY updated_at DESC",
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    content: row.content,
    isActive: row.is_active === 1,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

export async function saveUserInstruction(instruction: UserInstruction): Promise<void> {
  if (!getTursoConfig()) return;

  await tursoExecute(
    `INSERT OR REPLACE INTO user_instructions (id, name, content, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      instruction.id,
      instruction.name,
      instruction.content,
      instruction.isActive ? 1 : 0,
      instruction.createdAt.toISOString(),
      instruction.updatedAt.toISOString(),
    ],
  );
}

export async function deleteUserInstruction(id: string): Promise<void> {
  if (!getTursoConfig()) return;
  await tursoExecute("DELETE FROM user_instructions WHERE id = ?", [id]);
}

export async function setActiveInstruction(id: string | null): Promise<void> {
  if (!getTursoConfig()) return;

  await tursoExecuteMany([
    { sql: "UPDATE user_instructions SET is_active = 0", args: [] },
    ...(id ? [{ sql: "UPDATE user_instructions SET is_active = 1 WHERE id = ?", args: [id] }] : []),
  ]);
}

// ─── Skills ──────────────────────────────────────────────────────

export async function loadSkills(): Promise<Skill[]> {
  if (!getTursoConfig()) return [];

  const rows = await tursoSelect<TursoSkillRow>(
    "SELECT id, name, description, content, created_at, updated_at FROM skills ORDER BY updated_at DESC",
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    content: row.content,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

export async function saveSkill(skill: Skill): Promise<void> {
  if (!getTursoConfig()) return;

  await tursoExecute(
    `INSERT OR REPLACE INTO skills (id, name, description, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      skill.id,
      skill.name,
      skill.description,
      skill.content,
      skill.createdAt.toISOString(),
      skill.updatedAt.toISOString(),
    ],
  );
}

export async function deleteSkill(id: string): Promise<void> {
  if (!getTursoConfig()) return;
  await tursoExecute("DELETE FROM skills WHERE id = ?", [id]);
}

// ─── Custom Agents ───────────────────────────────────────────────

export async function loadCustomAgents(): Promise<CustomAgent[]> {
  if (!getTursoConfig()) return [];

  const rows = await tursoSelect<TursoCustomAgentRow>(
    "SELECT id, name, description, content, created_at, updated_at FROM custom_agents ORDER BY updated_at DESC",
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    content: row.content,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

export async function saveCustomAgent(agent: CustomAgent): Promise<void> {
  if (!getTursoConfig()) return;

  await tursoExecute(
    `INSERT OR REPLACE INTO custom_agents (id, name, description, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      agent.id,
      agent.name,
      agent.description,
      agent.content,
      agent.createdAt.toISOString(),
      agent.updatedAt.toISOString(),
    ],
  );
}

export async function deleteCustomAgent(id: string): Promise<void> {
  if (!getTursoConfig()) return;
  await tursoExecute("DELETE FROM custom_agents WHERE id = ?", [id]);
}
