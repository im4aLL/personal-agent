import { Outlet } from "react-router-dom";
import { Toaster } from "#components/ui/sonner";
import { AppSidebar } from "./app-sidebar";
import { ThemeProvider } from "./theme-provider";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./ui/sidebar";
import { TooltipProvider } from "./ui/tooltip";

export function Layout() {
  return (
    <ThemeProvider>
      <div className="flex h-svh overflow-hidden">
        <TooltipProvider delayDuration={300}>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="min-h-0">
              <div className="flex items-center gap-2 px-2 py-1 border-b">
                <SidebarTrigger />
              </div>
              <Outlet />
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </div>
      <Toaster />
    </ThemeProvider>
  );
}
