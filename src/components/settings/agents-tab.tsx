"use client";

import { BotIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import { ScrollArea } from "#components/ui/scroll-area";
import { Badge } from "#components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#components/ui/tabs";
import { Textarea } from "#components/ui/textarea";
import { getTursoConfig } from "#lib/turso";
import { cn } from "#lib/utils";
import type { CustomAgent, Skill, UserInstruction } from "#lib/types/chat";
import { useAgentsStore } from "#store/agents";

type SubTab = "instructions" | "skills" | "agents";

// ─── Instruction Dialog ──────────────────────────────────────────

function InstructionDialog({
  open,
  onOpenChange,
  editing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: UserInstruction | null;
  onSave: (name: string, content: string) => void;
}) {
  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  useState(() => {
    if (editing) {
      setName(editing.name);
      setContent(editing.content);
    } else {
      setName("");
      setContent("");
    }
  });

  function handleOpenChange(open: boolean) {
    if (open && editing) {
      setName(editing.name);
      setContent(editing.content);
    } else if (open && !editing) {
      setName("");
      setContent("");
    }
    onOpenChange(open);
  }

  function handleSubmit() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSave(trimmedName, content);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit instruction" : "New instruction"}</DialogTitle>
          <DialogDescription>
            User instructions are prepended to every chat message as system prompts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inst-name">Name</Label>
            <Input
              id="inst-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My coding rules"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inst-content">Content (Markdown)</Label>
            <Textarea
              id="inst-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your instructions in Markdown..."
              rows={10}
              className="max-h-60 overflow-auto font-mono text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {editing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Skill/Agent Dialog ──────────────────────────────────────────

function ItemDialog({
  open,
  onOpenChange,
  editing,
  onSave,
  type,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: (Skill | CustomAgent) | null;
  onSave: (name: string, description: string, content: string) => void;
  type: "skill" | "agent";
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");

  useState(() => {
    if (editing) {
      setName(editing.name);
      setDescription(editing.description);
      setContent(editing.content);
    } else {
      setName("");
      setDescription("");
      setContent("");
    }
  });

  function handleOpenChange(open: boolean) {
    if (open && editing) {
      setName(editing.name);
      setDescription(editing.description);
      setContent(editing.content);
    } else if (open && !editing) {
      setName("");
      setDescription("");
      setContent("");
    }
    onOpenChange(open);
  }

  function handleSubmit() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSave(trimmedName, description.trim(), content);
    onOpenChange(false);
  }

  const label = type === "skill" ? "skill" : "agent";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${label}` : `New ${label}`}</DialogTitle>
          <DialogDescription>
            {type === "skill"
              ? "Skills are one-shot prompts triggered by slash commands or mentions."
              : "Custom agents have their own system prompt and are triggered like skills."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${type}-name`}>Name</Label>
            <Input
              id={`${type}-name`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === "skill" ? "summarize" : "code-reviewer"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${type}-desc`}>Description</Label>
            <Input
              id={`${type}-desc`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this does"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${type}-content`}>Content</Label>
            <Textarea
              id={`${type}-content`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="System prompt content..."
              rows={8}
              className="max-h-60 overflow-auto font-mono text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {editing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ───────────────────────────────────────

function DeleteConfirmDialog({
  open,
  onOpenChange,
  name,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium text-foreground">{name}</span>? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Instructions Tab ────────────────────────────────────────────

function InstructionsTab() {
  const instructions = useAgentsStore((s) => s.userInstructions);
  const activeInstructionId = useAgentsStore((s) => s.activeInstructionId);
  const createInstruction = useAgentsStore((s) => s.createInstruction);
  const updateInstruction = useAgentsStore((s) => s.updateInstruction);
  const deleteInstruction = useAgentsStore((s) => s.deleteInstruction);
  const setActiveInstruction = useAgentsStore((s) => s.setActiveInstruction);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserInstruction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserInstruction | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = instructions.find((i) => i.id === selectedId) ?? null;

  function handleSave(name: string, content: string) {
    if (editing) {
      updateInstruction(editing.id, { name, content });
    } else {
      createInstruction(name, content);
    }
  }

  function handleEdit(instruction: UserInstruction) {
    setEditing(instruction);
    setDialogOpen(true);
  }

  function handleCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function handleToggleActive(instruction: UserInstruction) {
    if (activeInstructionId === instruction.id) {
      setActiveInstruction(null);
    } else {
      setActiveInstruction(instruction.id);
    }
  }

  return (
    <div className="flex gap-4 min-h-[400px]">
      {/* List */}
      <div className="w-64 shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Instructions</h3>
          <Button size="sm" variant="outline" onClick={handleCreate}>
            <PlusIcon className="size-3.5" />
            New
          </Button>
        </div>
        <ScrollArea className="h-[340px] rounded-md border">
          {instructions.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No instructions yet.</p>
          ) : (
            <div className="space-y-1 p-1">
              {instructions.map((instruction) => (
                <button
                  key={instruction.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                    selectedId === instruction.id && "bg-accent",
                  )}
                  onClick={() => setSelectedId(instruction.id)}
                >
                  <span className="flex-1 truncate">{instruction.name}</span>
                  {instruction.isActive && (
                    <Badge variant="secondary" className="text-xs">
                      Active
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Detail */}
      <div className="flex-1 min-w-0">
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{selected.name}</h3>
                {selected.isActive && (
                  <Badge variant="secondary" className="text-xs">
                    Active
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={selected.isActive ? "secondary" : "outline"}
                  onClick={() => handleToggleActive(selected)}
                >
                  {selected.isActive ? "Deactivate" : "Set active"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleEdit(selected)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDeleteTarget(selected)}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 p-4">
              <pre className="whitespace-pre-wrap font-mono text-sm">{selected.content}</pre>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select an instruction to view or edit.
          </div>
        )}
      </div>

      <InstructionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSave={handleSave}
      />

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        name={deleteTarget?.name ?? ""}
        onConfirm={() => {
          if (deleteTarget) {
            deleteInstruction(deleteTarget.id);
            if (selectedId === deleteTarget.id) setSelectedId(null);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}

// ─── Skills Tab ──────────────────────────────────────────────────

function SkillsTab() {
  const skills = useAgentsStore((s) => s.skills);
  const createSkill = useAgentsStore((s) => s.createSkill);
  const updateSkill = useAgentsStore((s) => s.updateSkill);
  const deleteSkill = useAgentsStore((s) => s.deleteSkill);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);

  function handleSave(name: string, description: string, content: string) {
    if (editing) {
      updateSkill(editing.id, { name, description, content });
    } else {
      createSkill(name, description, content);
    }
  }

  function handleEdit(skill: Skill) {
    setEditing(skill);
    setDialogOpen(true);
  }

  function handleCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Skills</h3>
        <Button size="sm" variant="outline" onClick={handleCreate}>
          <PlusIcon className="size-3.5" />
          New skill
        </Button>
      </div>

      {skills.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No skills yet. Skills are triggered with /skillname in chat.
        </p>
      ) : (
        <div className="space-y-2">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="flex items-start justify-between rounded-lg border p-4"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">/{skill.name}</span>
                </div>
                {skill.description && (
                  <p className="text-sm text-muted-foreground">{skill.description}</p>
                )}
                <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground line-clamp-2">
                  {skill.content}
                </pre>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => handleEdit(skill)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDeleteTarget(skill)}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSave={handleSave}
        type="skill"
      />

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        name={deleteTarget?.name ?? ""}
        onConfirm={() => {
          if (deleteTarget) {
            deleteSkill(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}

// ─── Agents Tab ──────────────────────────────────────────────────

function CustomAgentsTab() {
  const agents = useAgentsStore((s) => s.customAgents);
  const createCustomAgent = useAgentsStore((s) => s.createCustomAgent);
  const updateCustomAgent = useAgentsStore((s) => s.updateCustomAgent);
  const deleteCustomAgent = useAgentsStore((s) => s.deleteCustomAgent);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomAgent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomAgent | null>(null);

  function handleSave(name: string, description: string, content: string) {
    if (editing) {
      updateCustomAgent(editing.id, { name, description, content });
    } else {
      createCustomAgent(name, description, content);
    }
  }

  function handleEdit(agent: CustomAgent) {
    setEditing(agent);
    setDialogOpen(true);
  }

  function handleCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Custom agents</h3>
        <Button size="sm" variant="outline" onClick={handleCreate}>
          <PlusIcon className="size-3.5" />
          New agent
        </Button>
      </div>

      {agents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No custom agents yet. Agents are triggered with /agentname in chat.
        </p>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-start justify-between rounded-lg border p-4"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">/{agent.name}</span>
                </div>
                {agent.description && (
                  <p className="text-sm text-muted-foreground">{agent.description}</p>
                )}
                <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground line-clamp-2">
                  {agent.content}
                </pre>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => handleEdit(agent)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDeleteTarget(agent)}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSave={handleSave}
        type="agent"
      />

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        name={deleteTarget?.name ?? ""}
        onConfirm={() => {
          if (deleteTarget) {
            deleteCustomAgent(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}

// ─── Turso Guard Empty State ─────────────────────────────────────

function TursoNotConfigured() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <BotIcon className="mb-4 size-12 text-muted-foreground" />
      <h3 className="text-lg font-medium">Configure Turso to use agents</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        User instructions, skills, and custom agents require a Turso database connection.
        Set it up in the Data tab.
      </p>
    </div>
  );
}

// ─── Main Agent Tab ──────────────────────────────────────────────

export function AgentsTab() {
  const isLoading = useAgentsStore((s) => s.isLoading);
  const error = useAgentsStore((s) => s.error);

  if (!getTursoConfig()) {
    return <TursoNotConfigured />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-destructive">Error: {error}</p>
      </div>
    );
  }

  return <AgentsTabContent />;
}

function AgentsTabContent() {
  const [subTab, setSubTab] = useState<SubTab>("instructions");
  const userInstructions = useAgentsStore((s) => s.userInstructions);
  const skills = useAgentsStore((s) => s.skills);
  const customAgents = useAgentsStore((s) => s.customAgents);

  return (
    <Tabs value={subTab} onValueChange={(v) => setSubTab(v as SubTab)}>
      <TabsList>
        <TabsTrigger value="instructions">
          Instructions
          {userInstructions.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {userInstructions.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="skills">
          Skills
          {skills.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {skills.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="agents">
          Agents
          {customAgents.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {customAgents.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="instructions" className="mt-4">
        <InstructionsTab />
      </TabsContent>
      <TabsContent value="skills" className="mt-4">
        <SkillsTab />
      </TabsContent>
      <TabsContent value="agents" className="mt-4">
        <CustomAgentsTab />
      </TabsContent>
    </Tabs>
  );
}
