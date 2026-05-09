import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  CheckSquare,
  PlusCircle,
  Menu,
  Settings,
  Moon,
  SunMedium,
  Monitor,
  ChevronDown,
  LogOut,
  User,
} from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/notification-bell";
import { useClerk, useUser } from "@clerk/react";

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | "system">(
    (localStorage.getItem("theme") as "light" | "dark" | "system" | null) ?? "system",
  );
  const { signOut } = useClerk();
  const { user } = useUser();

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolved = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      root.classList.toggle("dark", resolved === "dark");
    };
    applyTheme();
    localStorage.setItem("theme", theme);
    if (theme !== "system") return;
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  const navItems = [
    { href: "/", label: "Tasks", icon: CheckSquare },
    { href: "/stats", label: "Dashboard", icon: LayoutDashboard },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const userDisplayName = user?.firstName
    ? user.firstName
    : user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ?? "Account";

  const userInitial = userDisplayName[0]?.toUpperCase() ?? "U";

  const SidebarContent = () => (
    <>
      <div className="h-14 flex items-center px-6 border-b border-sidebar-border font-semibold text-sidebar-foreground">
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
      <aside className="w-64 border-r border-sidebar-border bg-sidebar shrink-0 hidden md:flex flex-col">
        <SidebarContent />
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-64 p-0 flex flex-col bg-sidebar text-sidebar-foreground"
              >
                <SidebarContent />
              </SheetContent>
            </Sheet>
            <span className="font-semibold">Task Tracker</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <Button
              variant="ghost"
              className="h-8 px-3 text-xs sm:text-sm"
              onClick={() =>
                setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")
              }
            >
              {theme === "light" ? (
                <>
                  <SunMedium className="mr-2 h-4 w-4" />
                  Light
                </>
              ) : theme === "dark" ? (
                <>
                  <Moon className="mr-2 h-4 w-4" />
                  Dark
                </>
              ) : (
                <>
                  <Monitor className="mr-2 h-4 w-4" />
                  System
                </>
              )}
              <ChevronDown className="ml-2 h-3.5 w-3.5 opacity-70" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-2 px-2">
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
                    {userInitial}
                  </div>
                  <span className="hidden sm:block text-xs max-w-[100px] truncate">
                    {userDisplayName}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium truncate">{userDisplayName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.emailAddresses?.[0]?.emailAddress ?? ""}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-muted-foreground cursor-pointer" disabled>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={() => signOut({ redirectUrl: "/" })}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-3 sm:p-4 md:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </main>
    </div>
  );
}
