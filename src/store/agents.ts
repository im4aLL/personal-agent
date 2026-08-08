"use client";

import { create } from "zustand";
import {
  deleteCustomAgent as deleteCustomAgentRemote,
  deleteSkill as deleteSkillRemote,
  deleteUserInstruction as deleteUserInstructionRemote,
  loadCustomAgents as loadCustomAgentsRemote,
  loadSkills as loadSkillsRemote,
  loadUserInstructions as loadUserInstructionsRemote,
  saveCustomAgent,
  saveSkill,
  saveUserInstruction,
  setActiveInstruction as setActiveInstructionRemote,
} from "#lib/agent-repository";
import { runMigrations } from "#lib/turso-repository";
import { getTursoConfig } from "#lib/turso";
import type { CustomAgent, Skill, UserInstruction } from "#lib/types/chat";

function isTursoConfigured(): boolean {
  return getTursoConfig() !== null;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export type AgentsState = {
  // Data
  userInstructions: UserInstruction[];
  skills: Skill[];
  customAgents: CustomAgent[];

  // Active selections
  activeInstructionId: string | null;
  activeSkillId: string | null;
  activeAgentId: string | null;

  // Loading
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadFromTurso: () => Promise<void>;

  // Instructions CRUD
  createInstruction: (name: string, content: string) => void;
  updateInstruction: (
    id: string,
    updates: Partial<Pick<UserInstruction, "name" | "content">>,
  ) => void;
  deleteInstruction: (id: string) => void;
  setActiveInstruction: (id: string | null) => void;

  // Skills CRUD
  createSkill: (name: string, description: string, content: string) => void;
  updateSkill: (
    id: string,
    updates: Partial<Pick<Skill, "name" | "description" | "content">>,
  ) => void;
  deleteSkill: (id: string) => void;
  activateSkill: (id: string) => void;
  deactivateSkill: () => void;

  // Custom Agents CRUD
  createCustomAgent: (name: string, description: string, content: string) => void;
  updateCustomAgent: (
    id: string,
    updates: Partial<Pick<CustomAgent, "name" | "description" | "content">>,
  ) => void;
  deleteCustomAgent: (id: string) => void;
  activateAgent: (id: string) => void;
  deactivateAgent: () => void;

  // Helpers
  getActiveInstructionContent: () => string | null;
  getActiveSkillContent: () => string | null;
  getActiveAgentContent: () => string | null;
};

export const useAgentsStore = create<AgentsState>((set, get) => ({
  userInstructions: [],
  skills: [],
  customAgents: [],
  activeInstructionId: null,
  activeSkillId: null,
  activeAgentId: null,
  isLoaded: false,
  isLoading: false,
  error: null,

  loadFromTurso: async () => {
    if (!isTursoConfigured()) {
      set({ isLoaded: true, isLoading: false });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      await runMigrations();

      const [userInstructions, skills, customAgents] = await Promise.all([
        loadUserInstructionsRemote(),
        loadSkillsRemote(),
        loadCustomAgentsRemote(),
      ]);

      const activeInstruction = userInstructions.find((i) => i.isActive);

      set({
        userInstructions,
        skills,
        customAgents,
        activeInstructionId: activeInstruction?.id ?? null,
        isLoaded: true,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load agents";
      set({ error: message, isLoaded: true, isLoading: false });
    }
  },

  // ─── Instructions ───────────────────────────────────

  createInstruction: (name, content) => {
    const now = new Date();
    const instruction: UserInstruction = {
      id: createId("instr"),
      name,
      content,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      userInstructions: [instruction, ...state.userInstructions],
    }));

    if (isTursoConfigured()) {
      void saveUserInstruction(instruction);
    }
  },

  updateInstruction: (id, updates) => {
    set((state) => {
      const next = state.userInstructions.map((i) =>
        i.id === id ? { ...i, ...updates, updatedAt: new Date() } : i,
      );

      if (isTursoConfigured()) {
        const updated = next.find((i) => i.id === id);
        if (updated) {
          void saveUserInstruction(updated);
        }
      }

      return { userInstructions: next };
    });
  },

  deleteInstruction: (id) => {
    set((state) => {
      const next = state.userInstructions.filter((i) => i.id !== id);
      const nextActiveId = state.activeInstructionId === id ? null : state.activeInstructionId;

      if (isTursoConfigured()) {
        void deleteUserInstructionRemote(id);
        if (state.activeInstructionId === id) {
          void setActiveInstructionRemote(null);
        }
      }

      return { userInstructions: next, activeInstructionId: nextActiveId };
    });
  },

  setActiveInstruction: (id) => {
    set((state) => {
      const next = state.userInstructions.map((i) => ({
        ...i,
        isActive: i.id === id,
      }));

      if (isTursoConfigured()) {
        void setActiveInstructionRemote(id);
      }

      return { userInstructions: next, activeInstructionId: id };
    });
  },

  // ─── Skills ─────────────────────────────────────────

  createSkill: (name, description, content) => {
    const now = new Date();
    const skill: Skill = {
      id: createId("skill"),
      name,
      description,
      content,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      skills: [skill, ...state.skills],
    }));

    if (isTursoConfigured()) {
      void saveSkill(skill);
    }
  },

  updateSkill: (id, updates) => {
    set((state) => {
      const next = state.skills.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: new Date() } : s,
      );

      if (isTursoConfigured()) {
        const updated = next.find((s) => s.id === id);
        if (updated) {
          void saveSkill(updated);
        }
      }

      return { skills: next };
    });
  },

  deleteSkill: (id) => {
    set((state) => ({
      skills: state.skills.filter((s) => s.id !== id),
      activeSkillId: state.activeSkillId === id ? null : state.activeSkillId,
    }));

    if (isTursoConfigured()) {
      void deleteSkillRemote(id);
    }
  },

  activateSkill: (id) => {
    set({ activeSkillId: id });
  },

  deactivateSkill: () => {
    set({ activeSkillId: null });
  },

  // ─── Custom Agents ──────────────────────────────────

  createCustomAgent: (name, description, content) => {
    const now = new Date();
    const agent: CustomAgent = {
      id: createId("agent"),
      name,
      description,
      content,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      customAgents: [agent, ...state.customAgents],
    }));

    if (isTursoConfigured()) {
      void saveCustomAgent(agent);
    }
  },

  updateCustomAgent: (id, updates) => {
    set((state) => {
      const next = state.customAgents.map((a) =>
        a.id === id ? { ...a, ...updates, updatedAt: new Date() } : a,
      );

      if (isTursoConfigured()) {
        const updated = next.find((a) => a.id === id);
        if (updated) {
          void saveCustomAgent(updated);
        }
      }

      return { customAgents: next };
    });
  },

  deleteCustomAgent: (id) => {
    set((state) => ({
      customAgents: state.customAgents.filter((a) => a.id !== id),
      activeAgentId: state.activeAgentId === id ? null : state.activeAgentId,
    }));

    if (isTursoConfigured()) {
      void deleteCustomAgentRemote(id);
    }
  },

  activateAgent: (id) => {
    set({ activeAgentId: id });
  },

  deactivateAgent: () => {
    set({ activeAgentId: null });
  },

  // ─── Helpers ────────────────────────────────────────

  getActiveInstructionContent: () => {
    const state = get();
    if (!state.activeInstructionId) return null;
    const instruction = state.userInstructions.find((i) => i.id === state.activeInstructionId);
    return instruction?.content ?? null;
  },

  getActiveSkillContent: () => {
    const state = get();
    if (!state.activeSkillId) return null;
    const skill = state.skills.find((s) => s.id === state.activeSkillId);
    return skill?.content ?? null;
  },

  getActiveAgentContent: () => {
    const state = get();
    if (!state.activeAgentId) return null;
    const agent = state.customAgents.find((a) => a.id === state.activeAgentId);
    return agent?.content ?? null;
  },
}));
