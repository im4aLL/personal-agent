import { Outlet } from "react-router-dom";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider } from "./ui/sidebar";

export function Layout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </main>
    </SidebarProvider>
  );
}
