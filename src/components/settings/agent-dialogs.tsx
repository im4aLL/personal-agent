"use client";

import { useEffect, useState } from "react";
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
import { Textarea } from "#components/ui/textarea";
import type { CustomAgent, Skill, UserInstruction } from "#lib/types/chat";

// ─── Instruction Dialog ──────────────────────────────────────────

export function InstructionDialog({
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

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name);
        setContent(editing.content);
      } else {
        setName("");
        setContent("");
      }
    }
  }, [open, editing]);

  function handleOpenChange(open: boolean) {
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
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit instruction" : "New instruction"}</DialogTitle>
          <DialogDescription>
            User instructions are prepended to every chat message as system prompts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
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
              rows={16}
              className="min-h-[35vh] overflow-auto font-mono text-sm"
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

export function ItemDialog({
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

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name);
        setDescription(editing.description);
        setContent(editing.content);
      } else {
        setName("");
        setDescription("");
        setContent("");
      }
    }
  }, [open, editing]);

  function handleOpenChange(open: boolean) {
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
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${label}` : `New ${label}`}</DialogTitle>
          <DialogDescription>
            {type === "skill"
              ? "Skills are one-shot prompts triggered by slash commands or mentions."
              : "Custom agents have their own system prompt and are triggered like skills."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
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
              rows={14}
              className="min-h-[35vh] overflow-auto font-mono text-sm"
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

export function DeleteConfirmDialog({
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
