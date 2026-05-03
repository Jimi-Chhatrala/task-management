import { Link, useLocation } from "wouter";
import { LayoutDashboard, CheckSquare, PlusCircle, Menu } from "lucide-react";
import { ReactNode, useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Tasks", icon: CheckSquare },
    { href: "/stats", label: "Dashboard", icon: LayoutDashboard },
  ];

  const SidebarContent = () => (
    <>
      <div className="h-14 flex items-center px-6 border-b border-border font-semibold text-sidebar-foreground">
        Task Tracker
      </div>
      <div className="p-4 flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
              <div
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </div>
      <div className="p-4 border-t border-sidebar-border">
        <Link href="/tasks/new" onClick={() => setOpen(false)}>
          <div className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium cursor-pointer shadow-sm">
            <PlusCircle className="h-4 w-4" />
            New Task
          </div>
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex min-h-[100dvh] w-full bg-background">
      <aside className="w-64 border-r border-border bg-sidebar shrink-0 hidden md:flex flex-col">
        <SidebarContent />
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b border-border bg-card flex items-center px-4 md:hidden shrink-0">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 flex flex-col bg-sidebar">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <span className="font-semibold">Task Tracker</span>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </main>
    </div>
  );
}
