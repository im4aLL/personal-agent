import { ArrowLeftIcon } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Toaster } from "#components/ui/sonner";
import { selectSelectedConversation, useChatStore } from "#store/chat";
import { AppSidebar } from "./app-sidebar";
import { ChatWidthProvider } from "./chat-width-provider";
import { ShowMessageIconsProvider } from "./show-message-icons-provider";
import { ThemeProvider } from "./theme-provider";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./ui/sidebar";
import { TooltipProvider } from "./ui/tooltip";

export function Layout() {
  const location = useLocation();
  const isChatRoute = location.pathname === "/";
  // The chat page renders its own header (with the sidebar toggle) once a
  // conversation is selected, so this top bar is only needed elsewhere.
  const hasSelectedConversation = useChatStore(
    (state) => selectSelectedConversation(state) != null,
  );
  const showTopBar = !isChatRoute || !hasSelectedConversation;

  return (
    <ThemeProvider>
      <ShowMessageIconsProvider>
        <ChatWidthProvider>
          <div className="flex h-svh overflow-hidden">
            <TooltipProvider delayDuration={300}>
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset className="min-h-0">
                  {showTopBar && (
                    <div className="flex items-center gap-2 border-b px-2 py-1">
                      <SidebarTrigger />
                      {!isChatRoute && (
                        <Link
                          to="/"
                          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <ArrowLeftIcon className="size-4" />
                          Back to chat
                        </Link>
                      )}
                    </div>
                  )}
                  <Outlet />
                </SidebarInset>
              </SidebarProvider>
            </TooltipProvider>
          </div>
          <Toaster />
        </ChatWidthProvider>
      </ShowMessageIconsProvider>
    </ThemeProvider>
  );
}
