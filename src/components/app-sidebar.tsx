"use client";

import {
  ChevronDownIcon,
  Loader2Icon,
  MessageSquareIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Badge } from "#components/ui/badge";
import { Button } from "#components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "#components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog";
import { Input } from "#components/ui/input";
import { searchConversations } from "#lib/search";
import type { Conversation } from "#lib/types/chat";
import { useChatStore } from "#store/chat";
import { version } from "../../package.json";
import { PersonalAgentLogo } from "./personal-agent-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "./ui/sidebar";

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function differenceInCalendarDays(a: Date, b: Date) {
  return Math.floor((startOfDay(a).getTime() - startOfDay(b).getTime()) / (1000 * 60 * 60 * 24));
}

function groupConversations(conversations: Conversation[]) {
  const now = new Date();
  const sorted = [...conversations].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const groups = new Map<string, typeof conversations>([
    ["Today", []],
    ["Yesterday", []],
    ["Previous 7 days", []],
    ["Earlier", []],
  ]);

  for (const conversation of sorted) {
    const days = Math.max(0, differenceInCalendarDays(now, conversation.updatedAt));
    if (days === 0) {
      groups.get("Today")?.push(conversation);
    } else if (days === 1) {
      groups.get("Yesterday")?.push(conversation);
    } else if (days <= 7) {
      groups.get("Previous 7 days")?.push(conversation);
    } else {
      groups.get("Earlier")?.push(conversation);
    }
  }

  return Array.from(groups.entries()).filter(([, items]) => items.length > 0);
}

function DeleteConversationDialog({
  conversation,
  isOpen,
  onClose,
  onConfirm,
}: {
  conversation: Conversation | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete conversation</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{conversation?.title ?? ""}"? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
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

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tagsOpen, setTagsOpen] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const conversations = useChatStore((state) => state.conversations);
  const selectedConversationId = useChatStore((state) => state.selectedConversationId);
  const isHistoryLoading = useChatStore((state) => state.isHistoryLoading);
  const isHistoryLoaded = useChatStore((state) => state.isHistoryLoaded);
  const selectConversation = useChatStore((state) => state.selectConversation);
  const createConversation = useChatStore((state) => state.createConversation);
  const renameConversation = useChatStore((state) => state.renameConversation);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { allTags, taggedCount } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const conversation of conversations) {
      for (const tag of conversation.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return { allTags: sorted, taggedCount: sorted.length };
  }, [conversations]);

  const { pinnedConversations, unpinnedGroups } = useMemo(() => {
    let filtered = searchConversations(conversations, searchQuery.trim());
    if (selectedTag) {
      filtered = filtered.filter((c) => c.tags.includes(selectedTag));
    }
    const pinned = filtered
      .filter((c) => c.pinned)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const unpinned = filtered.filter((c) => !c.pinned);
    return {
      pinnedConversations: pinned,
      unpinnedGroups: groupConversations(unpinned),
    };
  }, [searchQuery, conversations, selectedTag]);

  function handleNewChat() {
    createConversation(true);
    navigate("/");
  }

  function startRename(conversation: Conversation) {
    setEditingId(conversation.id);
    setEditDraft(conversation.title);
    requestAnimationFrame(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    });
  }

  function commitRename(id: string) {
    const trimmed = editDraft.trim();
    if (trimmed) {
      renameConversation(id, trimmed);
    }
    setEditingId(null);
    setEditDraft("");
  }

  function cancelRename() {
    setEditingId(null);
    setEditDraft("");
  }

  function handleDeleteConfirm() {
    if (deleteTarget) {
      deleteConversation(deleteTarget.id);
    }
    setDeleteTarget(null);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          to="/"
          className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center"
        >
          <PersonalAgentLogo className="size-10 shrink-0 group-data-[collapsible=icon]:size-8" />
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold leading-tight">Personal Agent</span>
            <span className="text-xs text-muted-foreground leading-tight">v{version}</span>
          </div>
        </Link>
        <div className="px-2 group-data-[collapsible=icon]:hidden">
          <div className="relative">
            <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <SidebarInput
              placeholder="Search conversations..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="py-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="New Chat" onClick={handleNewChat}>
                <PlusIcon className="size-4" />
                <span>New Chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {taggedCount > 0 && (
          <Collapsible open={tagsOpen} onOpenChange={setTagsOpen}>
            <SidebarGroup className="py-1">
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:text-foreground">
                  Tags
                  <span className="ml-auto flex items-center gap-1">
                    <span className="text-muted-foreground text-[10px]">{taggedCount}</span>
                    <ChevronDownIcon
                      className={`size-3.5 text-muted-foreground transition-transform ${tagsOpen ? "rotate-180" : ""}`}
                    />
                  </span>
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenu>
                  {allTags.map(([tag, count]) => (
                    <SidebarMenuItem key={tag}>
                      <SidebarMenuButton
                        isActive={selectedTag === tag}
                        onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                      >
                        <span className="truncate flex-1 text-xs">{tag}</span>
                        <Badge
                          variant="secondary"
                          className="ml-auto px-1.5 py-0 text-[10px] shrink-0"
                        >
                          {count}
                        </Badge>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {selectedTag && (
          <div className="px-3 py-1.5">
            <Badge variant="secondary" className="gap-1 pr-1 text-xs">
              {selectedTag}
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                aria-label={`Clear tag filter ${selectedTag}`}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          </div>
        )}

        {pinnedConversations.length > 0 && (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel>Pinned</SidebarGroupLabel>
            <SidebarMenu>
              {pinnedConversations.map((conversation) => {
                const isEditing = editingId === conversation.id;

                return (
                  <SidebarMenuItem key={conversation.id}>
                    {isEditing ? (
                      <div className="flex flex-1 items-center gap-2 px-2 py-1.5">
                        <PinIcon className="size-4 shrink-0 text-muted-foreground" />
                        <Input
                          ref={editInputRef}
                          value={editDraft}
                          onChange={(event) => setEditDraft(event.target.value)}
                          onBlur={() => commitRename(conversation.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              commitRename(conversation.id);
                            } else if (event.key === "Escape") {
                              cancelRename();
                            }
                          }}
                          className="h-7 min-w-0 flex-1 px-2 py-1 text-sm"
                        />
                      </div>
                    ) : (
                      <>
                        <SidebarMenuButton
                          tooltip={conversation.title}
                          isActive={selectedConversationId === conversation.id}
                          onClick={() => {
                            selectConversation(conversation.id);
                            navigate("/");
                          }}
                          className="pr-14"
                        >
                          <PinIcon className="size-4" />
                          <span>{conversation.title}</span>
                        </SidebarMenuButton>
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/menu-item:opacity-100 focus-within:opacity-100 group-data-[collapsible=icon]:hidden">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Rename ${conversation.title}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              startRename(conversation);
                            }}
                          >
                            <PencilIcon className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Delete ${conversation.title}`}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget(conversation);
                            }}
                          >
                            <Trash2Icon className="size-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {pinnedConversations.length > 0 && unpinnedGroups.length > 0 && <SidebarSeparator />}

        {unpinnedGroups.map(([label, items]) => (
          <SidebarGroup key={label} className="py-1">
            <SidebarGroupLabel>{label}</SidebarGroupLabel>
            <SidebarMenu>
              {items.map((conversation) => {
                const isEditing = editingId === conversation.id;

                return (
                  <SidebarMenuItem key={conversation.id}>
                    {isEditing ? (
                      <div className="flex flex-1 items-center gap-2 px-2 py-1.5">
                        <MessageSquareIcon className="size-4 shrink-0 text-muted-foreground" />
                        <Input
                          ref={editInputRef}
                          value={editDraft}
                          onChange={(event) => setEditDraft(event.target.value)}
                          onBlur={() => commitRename(conversation.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              commitRename(conversation.id);
                            } else if (event.key === "Escape") {
                              cancelRename();
                            }
                          }}
                          className="h-7 min-w-0 flex-1 px-2 py-1 text-sm"
                        />
                      </div>
                    ) : (
                      <>
                        <SidebarMenuButton
                          tooltip={conversation.title}
                          isActive={selectedConversationId === conversation.id}
                          onClick={() => {
                            selectConversation(conversation.id);
                            navigate("/");
                          }}
                          className="pr-14"
                        >
                          <MessageSquareIcon className="size-4" />
                          <span>{conversation.title}</span>
                        </SidebarMenuButton>
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/menu-item:opacity-100 focus-within:opacity-100 group-data-[collapsible=icon]:hidden">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Rename ${conversation.title}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              startRename(conversation);
                            }}
                          >
                            <PencilIcon className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Delete ${conversation.title}`}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget(conversation);
                            }}
                          >
                            <Trash2Icon className="size-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}

        {isHistoryLoading && (
          <div className="flex items-center justify-center px-4 py-6 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin mr-2" />
            Loading conversations...
          </div>
        )}

        {!isHistoryLoading &&
          isHistoryLoaded &&
          conversations.length === 0 &&
          pinnedConversations.length === 0 &&
          unpinnedGroups.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No conversations yet.
            </div>
          )}

        {!isHistoryLoading &&
          pinnedConversations.length === 0 &&
          unpinnedGroups.length === 0 &&
          conversations.length > 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No conversations found.
            </div>
          )}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:justify-center">
          <SidebarMenu className="flex-1 group-data-[collapsible=icon]:flex-none">
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Settings"
                isActive={location.pathname === "/settings"}
                asChild
              >
                <Link to="/settings">
                  <SettingsIcon className="size-4" />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarFooter>

      <DeleteConversationDialog
        conversation={deleteTarget}
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </Sidebar>
  );
}
