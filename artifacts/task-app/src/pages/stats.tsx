import { useGetTaskStats, getGetTaskStatsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { CheckSquare, Clock, BarChart3, TrendingUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityBadge } from "@/components/priority-badge";

export default function Stats() {
  const { data: stats, isLoading, error } = useGetTaskStats({
    query: { queryKey: getGetTaskStatsQueryKey() }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Overview of your workspace.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Failed to load statistics</h2>
        <p className="text-muted-foreground mt-2">There was an error fetching your dashboard data.</p>
      </div>
    );
  }

  const priorities = ["highest", "high", "medium", "low", "lowest"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">High-level overview of your tasks and time.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">across all priorities</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Time Logged</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{stats.total_time_formatted || "0m"}</div>
            <p className="text-xs text-muted-foreground mt-1">total hours spent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Time per Task</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">
              {stats.total > 0 
                ? `${Math.round(stats.total_time_minutes / stats.total / 60)}h ${Math.round((stats.total_time_minutes / stats.total) % 60)}m` 
                : "0m"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">estimated effort</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Tasks by Priority
            </CardTitle>
            <CardDescription>Distribution of active tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mt-4">
              {priorities.map(p => {
                const count = stats.by_priority[p] || 0;
                const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0;
                
                return (
                  <div key={p} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize font-medium">{p}</span>
                      <span className="text-muted-foreground font-mono">{count} ({percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          p === 'highest' ? 'bg-red-500' :
                          p === 'high' ? 'bg-orange-500' :
                          p === 'medium' ? 'bg-amber-500' :
                          p === 'low' ? 'bg-blue-500' : 'bg-gray-400'
                        }`} 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recently Updated</CardTitle>
            <CardDescription>The last 5 active tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recent_tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tasks available yet.
                </div>
              ) : (
                stats.recent_tasks.map(task => (
                  <Link key={task.id} href={`/tasks/${task.id}`}>
                    <div className="flex items-start justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border cursor-pointer group">
                      <div className="space-y-1 overflow-hidden pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{task.task_number}</span>
                          <PriorityBadge priority={task.priority} />
                        </div>
                        <div className="font-medium truncate group-hover:text-primary transition-colors">
                          {task.task_title}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap pt-1">
                        {format(new Date(task.updated_at), "MMM d")}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
