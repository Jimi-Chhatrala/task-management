import { useState } from "react";
import { Link } from "wouter";
import { format, isPast, isToday, isTomorrow, differenceInDays } from "date-fns";
import { Search, ArrowUpDown, CheckSquare, Plus, Clock, AlertCircle } from "lucide-react";
import {
  useListTasks,
  useListStatuses,
  getListTasksQueryKey,
} from "@workspace/api-client-react";
import type { Task } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusBadge } from "../components/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";

function DueDateBadge({ dueDate, isOverdue }: { dueDate: string | null | undefined; isOverdue: boolean }) {
  if (!dueDate) return <span className="text-muted-foreground">—</span>;

  const date = new Date(dueDate);

  if (isOverdue) {
    const daysAgo = differenceInDays(new Date(), date);
    return (
      <Badge variant="destructive" className="text-xs gap-1 font-medium">
        <AlertCircle className="h-3 w-3" />
        {daysAgo === 0 ? "Today" : `${daysAgo}d overdue`}
      </Badge>
    );
  }

  if (isToday(date)) {
    return <Badge className="text-xs bg-amber-500 hover:bg-amber-500 text-white">Due today</Badge>;
  }
  if (isTomorrow(date)) {
    return <Badge variant="secondary" className="text-xs">Due tomorrow</Badge>;
  }

  const daysLeft = differenceInDays(date, new Date());
  if (daysLeft <= 3) {
    return (
      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
        {format(date, "MMM d")}
      </span>
    );
  }

  return <span className="text-sm text-muted-foreground whitespace-nowrap">{format(date, "MMM d, yyyy")}</span>;
}

export default function Home() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [priority, setPriority] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("updated_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const { data: statuses } = useListStatuses();

  const queryParams = {
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(priority !== "all" ? { priority: priority as any } : {}),
    ...(status !== "all" ? { status } : {}),
    ...(overdueOnly ? { overdue: "true" as const } : {}),
    sortBy: sortBy as any,
    sortOrder,
  };

  const { data: tasks, isLoading } = useListTasks(queryParams, {
    query: { queryKey: getListTasksQueryKey(queryParams) },
  });

  const overdueCount = tasks?.filter((t) => t.is_overdue).length ?? 0;

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const SortableHead = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer hover:text-foreground transition-colors group"
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortBy === field ? "text-primary opacity-100" : "opacity-0 group-hover:opacity-50 transition-opacity"}`} />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground text-sm">Manage and track your work items.</p>
        </div>
        <Link href="/tasks/new">
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Create Task
          </Button>
        </Link>
      </div>

      {/* Overdue banner */}
      {!isLoading && overdueCount > 0 && !overdueOnly && (
        <button
          onClick={() => setOverdueOnly(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium hover:bg-destructive/15 transition-colors text-left"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {overdueCount} task{overdueCount !== 1 ? "s are" : " is"} overdue — click to filter
        </button>
      )}

      <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 flex-wrap">
        <div className="relative w-full lg:flex-1 lg:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            className="pl-9 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="Filter by priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="highest">Highest</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="lowest">Lowest</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses?.map((s) => (
              <SelectItem key={s.id} value={s.name}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {overdueOnly && (
          <Button variant="outline" size="sm" className="text-destructive border-destructive/30" onClick={() => setOverdueOnly(false)}>
            <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
            Overdue only ✕
          </Button>
        )}
      </div>

      <Card className="border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <SortableHead field="task_number">ID</SortableHead>
                <TableHead>Title</TableHead>
                <SortableHead field="priority">Priority</SortableHead>
                <SortableHead field="status">Status</SortableHead>
                <SortableHead field="due_date">Due Date</SortableHead>
                <SortableHead field="time_spent_minutes">Logged</SortableHead>
                <SortableHead field="updated_at">Updated</SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : tasks?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <CheckSquare className="h-10 w-10 mb-4 opacity-20" />
                      <p className="text-lg font-medium text-foreground">No tasks found</p>
                      <p className="text-sm">Try adjusting your search or filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                tasks?.map((task) => (
                  <TableRow
                    key={task.id}
                    className={`group ${task.is_overdue ? "bg-destructive/5 hover:bg-destructive/10" : ""}`}
                  >
                    <TableCell className="font-mono text-xs font-medium text-muted-foreground">
                      <Link href={`/tasks/${task.id}`} className="hover:text-primary transition-colors">
                        {task.task_number}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px]">
                      <Link href={`/tasks/${task.id}`} className="hover:text-primary transition-colors flex items-center gap-2">
                        <span className="truncate">{task.task_title}</span>
                        {task.is_overdue && <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={task.priority} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={task.status} statuses={statuses} />
                    </TableCell>
                    <TableCell>
                      <DueDateBadge dueDate={task.due_date} isOverdue={task.is_overdue} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm font-mono bg-muted/50 px-2 py-0.5 rounded w-max">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {task.time_spent_formatted}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(task.updated_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
