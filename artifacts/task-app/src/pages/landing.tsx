import { Link } from "wouter";
import { CheckSquare, BarChart2, Bell, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <CheckSquare className="h-5 w-5 text-primary" />
          Task Tracker
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sign-in">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link href="/sign-up">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Jira-style task management
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
            Manage your work,<br />your way
          </h1>

          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Create tasks, track progress, log time, and stay on top of everything — all in one place.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2 w-full sm:w-auto">
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Sign in
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto w-full text-left">
          <div className="rounded-lg border border-border bg-card p-5 space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <CheckSquare className="h-5 w-5" />
              <span className="font-semibold text-foreground text-sm">Task Management</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Create, update, and track tasks with priorities, statuses, due dates, and rich descriptions.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5 space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <BarChart2 className="h-5 w-5" />
              <span className="font-semibold text-foreground text-sm">Stats Dashboard</span>
            </div>
            <p className="text-sm text-muted-foreground">
              See a breakdown by priority and status, total time logged, overdue tasks, and recent activity.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-5 space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <Bell className="h-5 w-5" />
              <span className="font-semibold text-foreground text-sm">Notifications</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Stay updated with in-app notifications for task creation and status changes.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
