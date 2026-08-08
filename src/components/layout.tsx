import { Outlet } from "react-router-dom";
import { Toaster } from "#components/ui/sonner";
import { AppSidebar } from "./app-sidebar";
import { ThemeProvider } from "./theme-provider";
import { SidebarInset, SidebarProvider } from "./ui/sidebar";
import { TooltipProvider } from "./ui/tooltip";

export function Layout() {
  return (
    <ThemeProvider>
      <div className="flex h-svh overflow-hidden">
        <TooltipProvider delayDuration={300}>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="min-h-0">
              <Outlet />
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </div>
      <Toaster />
    </ThemeProvider>
  );
}
