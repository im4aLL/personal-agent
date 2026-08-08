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
import { searchConversations } from "#lib/turso-repository";
import type { Conversation, ConversationSummary } from "#lib/types/chat";
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
  const [searchResults, setSearchResults] = useState<ConversationSummary[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const editInputRef = useRef<HTMLInputElement>(null);

  const conversations = useChatStore((state) => state.conversations);
  const selectedConversationId = useChatStore((state) => state.selectedConversationId);
  const isHistoryLoading = useChatStore((state) => state.isHistoryLoading);
  const isHistoryLoaded = useChatStore((state) => state.isHistoryLoaded);
  const selectConversation = useChatStore((state) => state.selectConversation);
  const createConversation = useChatStore((state) => state.createConversation);
  const renameConversation = useChatStore((state) => state.renameConversation);
  const deleteConversation = useChatStore((state) => state.deleteConversation);
  const today = useChatStore((state) => state.today);
  const yesterday = useChatStore((state) => state.yesterday);
  const previous7Days = useChatStore((state) => state.previous7Days);
  const monthGroups = useChatStore((state) => state.monthGroups);
  const monthConversations = useChatStore((state) => state.monthConversations);
  const monthConversationLimits = useChatStore((state) => state.monthConversationLimits);
  const monthsLoading = useChatStore((state) => state.monthsLoading);
  const loadMonthConversations = useChatStore((state) => state.loadMonthConversations);
  const loadMoreMonthConversations = useChatStore((state) => state.loadMoreMonthConversations);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;

    searchConversations(trimmed)
      .then((results) => {
        if (!cancelled) setSearchResults(results);
      })
      .catch(() => {
        if (!cancelled) setSearchResults([]);
      });

    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

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

  // Build lookup from conversation id to full Conversation for sidebar rendering.
  const conversationById = useMemo(() => {
    const map = new Map<string, Conversation>();
    for (const c of conversations) {
      map.set(c.id, c);
    }
    return map;
  }, [conversations]);

  const { pinnedConversations, unpinnedGroups } = useMemo(() => {
    const isSearching = searchQuery.trim().length > 0;

    if (isSearching) {
      // Search results are ConversationSummary; show them as a flat group.
      const searchConversations: Conversation[] = searchResults.map((s) => ({
        ...s,
        messages: [],
      }));
      let filtered = selectedTag
        ? searchConversations.filter((c) => c.tags.includes(selectedTag))
        : searchConversations;
      const pinned = filtered
        .filter((c) => c.pinned)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      const unpinned = filtered.filter((c) => !c.pinned);
      return {
        pinnedConversations: pinned,
        unpinnedGroups:
          unpinned.length > 0 ? ([["Search Results", unpinned]] as [string, Conversation[]][]) : [],
      };
    }

    // Non-search mode: use pre-grouped store slices.
    function resolveSlice(summaries: ConversationSummary[]) {
      let items = summaries
        .map((s) => conversationById.get(s.id))
        .filter((c): c is Conversation => c != null);
      if (selectedTag) {
        items = items.filter((c) => c.tags.includes(selectedTag));
      }
      return items;
    }

    const todayItems = resolveSlice(today);
    const yesterdayItems = resolveSlice(yesterday);
    const previous7DaysItems = resolveSlice(previous7Days);

    let pinned = conversations
      .filter((c) => c.pinned)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    if (selectedTag) {
      pinned = pinned.filter((c) => c.tags.includes(selectedTag));
    }

    const groups: [string, Conversation[]][] = [];
    if (todayItems.length > 0) groups.push(["Today", todayItems]);
    if (yesterdayItems.length > 0) groups.push(["Yesterday", yesterdayItems]);
    if (previous7DaysItems.length > 0) groups.push(["Previous 7 days", previous7DaysItems]);

    return { pinnedConversations: pinned, unpinnedGroups: groups };
  }, [searchQuery, searchResults, conversations, selectedTag, today, yesterday, previous7Days, conversationById]);

  // Build a label->month-key lookup from monthGroups.
  const labelToMonthKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const mg of monthGroups) {
      map.set(mg.label, mg.month);
    }
    return map;
  }, [monthGroups]);

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

  function toggleMonth(label: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
        // Trigger lazy loading of month conversations.
        const monthKey = labelToMonthKey.get(label);
        if (monthKey) {
          void loadMonthConversations(monthKey);
        }
      }
      return next;
    });
  }

  function renderConversationItem(
    conversation: Conversation,
    { icon: Icon = MessageSquareIcon }: { icon?: React.ComponentType<{ className?: string }> } = {},
  ) {
    const isEditing = editingId === conversation.id;

    return (
      <SidebarMenuItem key={conversation.id}>
        {isEditing ? (
          <div className="flex flex-1 items-center gap-2 px-2 py-1.5">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
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
              <Icon className="size-4" />
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
              {pinnedConversations.map((conversation) =>
                renderConversationItem(conversation, { icon: PinIcon }),
              )}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {pinnedConversations.length > 0 && unpinnedGroups.length > 0 && <SidebarSeparator />}

        {unpinnedGroups.map(([label, items]) => (
          <div key={label}>
            <SidebarGroup className="py-1">
              <SidebarGroupLabel>{label}</SidebarGroupLabel>
              <SidebarMenu>
                {items.map((conversation) => renderConversationItem(conversation))}
              </SidebarMenu>
            </SidebarGroup>
          </div>
        ))}

        {!searchQuery.trim() &&
          !selectedTag &&
          monthGroups.map((mg) => {
            const isOpen = expandedMonths.has(mg.label);
            const loadedItems = monthConversations[mg.month] ?? [];

            return (
              <Collapsible key={mg.month} open={isOpen} onOpenChange={() => toggleMonth(mg.label)}>
                <SidebarGroup className="py-1">
                  <CollapsibleTrigger asChild>
                    <SidebarGroupLabel className="cursor-pointer hover:text-foreground">
                      {mg.label}
                      <span className="ml-auto flex items-center gap-1">
                        <span className="text-muted-foreground text-[10px]">{mg.count}</span>
                        <ChevronDownIcon
                          className={`size-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </span>
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenu>
                      {loadedItems.map((summary) => {
                        const conversation = conversationById.get(summary.id);
                        return conversation ? renderConversationItem(conversation) : null;
                      })}
                      {monthConversationLimits[mg.month]?.hasMore && (
                        <SidebarMenuItem>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-xs text-muted-foreground"
                            disabled={monthsLoading.has(mg.month)}
                            onClick={() => loadMoreMonthConversations(mg.month)}
                          >
                            {monthsLoading.has(mg.month) ? "Loading..." : "View more"}
                          </Button>
                        </SidebarMenuItem>
                      )}
                    </SidebarMenu>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          })}

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
