import { Outlet } from "react-router-dom";
import { Toaster } from "#components/ui/sonner";
import { AppSidebar } from "./app-sidebar";
import { ThemeProvider } from "./theme-provider";
import { SidebarInset, SidebarProvider } from "./ui/sidebar";

export function Layout() {
  return (
    <ThemeProvider>
      <div className="flex h-svh overflow-hidden">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="min-h-0">
            <Outlet />
          </SidebarInset>
        </SidebarProvider>
      </div>
      <Toaster />
    </ThemeProvider>
  );
}
