import { Outlet } from "react-router-dom";
import { Toaster } from "#components/ui/sonner";
import { selectSelectedConversation, useChatStore } from "#store/chat";
import { AppSidebar } from "./app-sidebar";
import { ChatWidthProvider } from "./chat-width-provider";
import { ShowMessageIconsProvider } from "./show-message-icons-provider";
import { ThemeProvider } from "./theme-provider";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./ui/sidebar";
import { TooltipProvider } from "./ui/tooltip";

export function Layout() {
  // The chat page renders its own header (with the sidebar toggle) once a
  // conversation is selected, so this top bar is only needed elsewhere.
  const hasSelectedConversation = useChatStore((state) => selectSelectedConversation(state) != null);

  return (
    <ThemeProvider>
      <ShowMessageIconsProvider>
        <ChatWidthProvider>
          <div className="flex h-svh overflow-hidden">
            <TooltipProvider delayDuration={300}>
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset className="min-h-0">
                  {!hasSelectedConversation && (
                    <div className="flex items-center gap-2 px-2 py-1 border-b">
                      <SidebarTrigger />
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
