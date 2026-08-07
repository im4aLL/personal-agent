"use client";

import { MessageSquare, Pencil, Plus, Search, Settings, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "#components/ui/button";
import { ThemeToggle } from "./theme-toggle";
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
} from "./ui/sidebar";

type Conversation = {
  id: string;
  title: string;
  updatedAt: Date;
};

const MOCK_CONVERSATIONS: Conversation[] = [
  { id: "1", title: "Trip planning ideas", updatedAt: new Date() },
  { id: "2", title: "Recipe for dinner", updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3) },
  { id: "3", title: "React patterns", updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 26) },
  { id: "4", title: "Meeting notes", updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 50) },
  {
    id: "5",
    title: "Book recommendations",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
  },
  {
    id: "6",
    title: "Old project ideas",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
  },
];

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

  const groups = new Map<string, Conversation[]>([
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

function handleNewChat() {
  toast("Coming soon");
}

function handleRename(_id: string) {
  toast("Coming soon");
}

function handleDelete(_id: string) {
  toast("Coming soon");
}

export function AppSidebar() {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const conversations = query
      ? MOCK_CONVERSATIONS.filter((conversation) =>
          conversation.title.toLowerCase().includes(query),
        )
      : MOCK_CONVERSATIONS;
    return groupConversations(conversations);
  }, [searchQuery]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 group-data-[collapsible=icon]:hidden">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <SidebarInput
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
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
                <Plus className="size-4" />
                <span>New Chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {filteredGroups.map(([label, conversations]) => (
          <SidebarGroup key={label} className="py-1">
            <SidebarGroupLabel>{label}</SidebarGroupLabel>
            <SidebarMenu>
              {conversations.map((conversation) => (
                <SidebarMenuItem key={conversation.id}>
                  <SidebarMenuButton tooltip={conversation.title} className="pr-14">
                    <MessageSquare className="size-4" />
                    <span>{conversation.title}</span>
                  </SidebarMenuButton>
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/menu-item:opacity-100 focus-within:opacity-100 group-data-[collapsible=icon]:hidden">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Rename ${conversation.title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRename(conversation.id);
                      }}
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Delete ${conversation.title}`}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(conversation.id);
                      }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}

        {filteredGroups.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No conversations found.
          </div>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-1">
          <SidebarMenu className="flex-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Settings"
                isActive={location.pathname === "/settings"}
                asChild
              >
                <Link to="/settings">
                  <Settings className="size-4" />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
