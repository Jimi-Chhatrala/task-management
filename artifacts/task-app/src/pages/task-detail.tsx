import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { format, isPast, isToday, isTomorrow, differenceInDays } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Clock, CalendarIcon, Edit2, Check,
  X, Trash2, AlertTriangle, Bell, BellOff, AlertCircle
} from "lucide-react";

import {
  useGetTask,
  useUpdateTask,
  useDeleteTask,
  useLogTime,
  useListStatuses,
  getGetTaskQueryKey,
  getListTasksQueryKey,
  getGetTaskStatsQueryKey
} from "@workspace/api-client-react";
import type { TaskStatusConfig } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityBadge } from "@/components/priority-badge";
import { StatusBadge } from "@/components/status-badge";
import { TaskAttachments } from "@/components/task-attachments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const logTimeSchema = z.object({
  time_input: z.string().min(1, "Time is required").refine(val => /^(?:\d+[dhm]\s*)+$/.test(val), {
    message: "Invalid format. Use 1d 2h 30m"
  })
});

function DueDateDisplay({ dueDate, isOverdue }: { dueDate: string | null | undefined; isOverdue: boolean }) {
  if (!dueDate) return <span className="text-muted-foreground">—</span>;
  const date = new Date(dueDate);

  if (isOverdue) {
    const daysAgo = differenceInDays(new Date(), date);
    return (
      <Badge variant="destructive" className="text-xs gap-1">
        <AlertCircle className="h-3 w-3" />
        {daysAgo === 0 ? "Due today (overdue)" : `${daysAgo}d overdue`}
      </Badge>
    );
  }
  if (isToday(date)) return <Badge className="text-xs bg-amber-500 hover:bg-amber-500 text-white">Due today</Badge>;
  if (isTomorrow(date)) return <Badge variant="secondary" className="text-xs">Due tomorrow</Badge>;

  const daysLeft = differenceInDays(date, new Date());
  if (daysLeft <= 3) {
    return <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{format(date, "MMM d, yyyy")} ({daysLeft}d left)</span>;
  }
  return <span className="font-medium">{format(date, "MMM d, yyyy")}</span>;
}

function ReminderDisplay({ reminderAt }: { reminderAt: string | null | undefined }) {
  if (!reminderAt) return <span className="text-muted-foreground">—</span>;
  const date = new Date(reminderAt);
  const fired = isPast(date);
  return (
    <div className="flex items-center gap-1.5">
      {fired ? (
        <Bell className="h-3.5 w-3.5 text-amber-500" />
      ) : (
        <Bell className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span className={cn("font-medium", fired && "text-amber-600 dark:text-amber-400")}>
        {format(date, "MMM d, yyyy")}
        {fired && " (fired)"}
      </span>
    </div>
  );
}

export default function TaskDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);

  const { data: task, isLoading, error } = useGetTask(id, {
    query: { enabled: !!id, queryKey: getGetTaskQueryKey(id) }
  });

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const logTime = useLogTime();

  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPriority, setEditPriority] = useState<"lowest" | "low" | "medium" | "high" | "highest">("medium");
  const [editStatus, setEditStatus] = useState<string>("todo");
  const [editDueDate, setEditDueDate] = useState<Date | null>(null);
  const [editReminderAt, setEditReminderAt] = useState<Date | null>(null);
  const { data: statuses } = useListStatuses();

  const timeForm = useForm<z.infer<typeof logTimeSchema>>({
    resolver: zodResolver(logTimeSchema),
    defaultValues: { time_input: "" }
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-12 w-full max-w-lg" />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-4">
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Task not found</h2>
        <p className="text-muted-foreground mt-2 mb-6">The task you are looking for doesn't exist or has been deleted.</p>
        <Link href="/">
          <Button>Back to Tasks</Button>
        </Link>
      </div>
    );
  }

  const startEditing = () => {
    setEditTitle(task.task_title);
    setEditDesc(task.task_description || "");
    setEditPriority(task.priority);
    setEditStatus(task.status);
    setEditDueDate(task.due_date ? new Date(task.due_date) : null);
    setEditReminderAt(task.reminder_at ? new Date(task.reminder_at) : null);
    setIsEditing(true);
  };

  const saveEdit = () => {
    const nextLiveDate = editStatus === "done" ? task.production_live_date ?? new Date().toISOString().slice(0, 10) : null;
    updateTask.mutate({
      id,
      data: {
        task_title: editTitle,
        task_description: editDesc,
        priority: editPriority,
        status: editStatus,
        production_live_date: nextLiveDate,
        due_date: editDueDate ? editDueDate.toISOString() : null,
        reminder_at: editReminderAt ? editReminderAt.toISOString() : null,
      }
    }, {
      onSuccess: (updatedTask) => {
        setIsEditing(false);
        queryClient.setQueryData(getGetTaskQueryKey(id), updatedTask);
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        toast({ title: "Task updated" });
      },
      onError: () => toast({ variant: "destructive", title: "Failed to update task" })
    });
  };

  const handleDelete = () => {
    deleteTask.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Task deleted" });
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTaskStatsQueryKey() });
        setLocation("/");
      },
      onError: () => toast({ variant: "destructive", title: "Failed to delete task" })
    });
  };

  const onLogTime = (values: z.infer<typeof logTimeSchema>) => {
    logTime.mutate({
      id,
      data: values
    }, {
      onSuccess: (updatedTask) => {
        timeForm.reset();
        queryClient.setQueryData(getGetTaskQueryKey(id), updatedTask);
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTaskStatsQueryKey() });
        toast({ title: "Time logged successfully" });
      },
      onError: (err: any) => toast({ variant: "destructive", title: "Failed to log time", description: err.error })
    });
  };

  const statusOptions = (statuses ?? []) as TaskStatusConfig[];

  const reminderFired = task.reminder_at ? isPast(new Date(task.reminder_at)) : false;

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
      {/* Overdue banner */}
      {task.is_overdue && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" />
          This task is overdue — it was due {task.due_date ? format(new Date(task.due_date), "MMMM d, yyyy") : "in the past"}.
        </div>
      )}

      {/* Reminder fired banner */}
      {reminderFired && !task.is_overdue && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm font-medium">
          <Bell className="h-4 w-4 shrink-0" />
          Reminder: {task.reminder_at ? format(new Date(task.reminder_at), "MMMM d, yyyy") : ""} — don't forget this task!
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="icon" className="shrink-0 h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="font-mono text-sm text-muted-foreground bg-muted/50 px-2 py-1 rounded">
            {task.task_number}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-transparent">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete task {task.task_number}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              {isEditing ? (
                <div className="space-y-4">
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-2xl font-bold h-14" />
                  <RichTextEditor value={editDesc} onChange={setEditDesc} placeholder="Describe the task..." />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Priority</label>
                      <Select value={editPriority} onValueChange={(value) => setEditPriority(value as typeof editPriority)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="highest">Highest</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="lowest">Lowest</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Status</label>
                      <Select value={editStatus} onValueChange={setEditStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((s) => (
                            <SelectItem key={s.id} value={s.name}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Due Date edit */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Due Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn("w-full pl-3 text-left font-normal", !editDueDate && "text-muted-foreground")}
                          >
                            {editDueDate ? format(editDueDate, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={editDueDate || undefined} onSelect={(d) => setEditDueDate(d ?? null)} initialFocus />
                          {editDueDate && (
                            <div className="p-2 border-t">
                              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setEditDueDate(null)}>Clear date</Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Reminder edit */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Reminder</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn("w-full pl-3 text-left font-normal", !editReminderAt && "text-muted-foreground")}
                          >
                            {editReminderAt ? format(editReminderAt, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={editReminderAt || undefined} onSelect={(d) => setEditReminderAt(d ?? null)} initialFocus />
                          {editReminderAt && (
                            <div className="p-2 border-t">
                              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setEditReminderAt(null)}>Clear reminder</Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button size="sm" onClick={saveEdit} disabled={updateTask.isPending}>
                      <Check className="h-4 w-4 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                      <X className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 flex-wrap">
                    <CardTitle className="text-2xl sm:text-3xl">{task.task_title}</CardTitle>
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={task.status} statuses={statusOptions} />
                  </div>
                  {task.task_description && (
                    <div className="prose prose-sm max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: task.task_description }} />
                  )}
                </>
              )}
            </CardHeader>
          </Card>

          {/* Time logging */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Log Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...timeForm}>
                <form onSubmit={timeForm.handleSubmit(onLogTime)} className="flex gap-3">
                  <FormField
                    control={timeForm.control}
                    name="time_input"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input placeholder="e.g. 1h 30m" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={logTime.isPending}>
                    {logTime.isPending ? "Logging..." : "Log"}
                  </Button>
                </form>
              </Form>
              <p className="text-xs text-muted-foreground mt-2">
                Total logged: <span className="font-mono font-medium">{task.time_spent_formatted}</span>
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Priority</span>
                <span className="capitalize font-medium">{task.priority}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={task.status} statuses={statusOptions} />
              </div>
              <div className="flex justify-between items-start py-1 border-b border-border/50 gap-2">
                <span className="text-muted-foreground shrink-0">Due Date</span>
                <div className="text-right">
                  <DueDateDisplay dueDate={task.due_date} isOverdue={task.is_overdue} />
                </div>
              </div>
              <div className="flex justify-between items-start py-1 border-b border-border/50 gap-2">
                <span className="text-muted-foreground shrink-0">Reminder</span>
                <div className="text-right">
                  <ReminderDisplay reminderAt={task.reminder_at} />
                </div>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Live Date</span>
                <span className="font-medium">
                  {task.production_live_date ? format(new Date(task.production_live_date), "MMM d, yyyy") : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Updated</span>
                <span>{format(new Date(task.updated_at), "MMM d")}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(task.created_at), "MMM d, yyyy")}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskAttachments taskId={task.id} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
