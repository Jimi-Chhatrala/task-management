import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { format, isPast, isToday, isTomorrow, differenceInDays } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Clock, CalendarIcon, Edit2, Check,
  X, Trash2, AlertTriangle, Bell, AlertCircle,
  Copy, Plus, CheckSquare, Square, Link2, Unlink
} from "lucide-react";

import {
  useGetTask,
  useUpdateTask,
  useDeleteTask,
  useLogTime,
  useListStatuses,
  useCloneTask,
  useListSubtasks,
  useCreateSubtask,
  useUpdateSubtask,
  useDeleteSubtask,
  useListTaskRelations,
  useCreateTaskRelation,
  useDeleteTaskRelation,
  useListTasks,
  getGetTaskQueryKey,
  getListTasksQueryKey,
  getGetTaskStatsQueryKey,
  getListSubtasksQueryKey,
  getListTaskRelationsQueryKey,
} from "@workspace/api-client-react";
import type {
  TaskStatusConfig,
  UpdateTaskBody,
  TaskRelationRelationType,
} from "@workspace/api-client-react";

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
  const displayStr = format(date, "MMM d, yyyy 'at' h:mm a");
  return (
    <div className="flex items-center gap-1.5">
      <Bell className="h-3.5 w-3.5 text-muted-foreground" />
      <span className={cn("font-medium", fired && "text-amber-600 dark:text-amber-400")}>
        {displayStr}
        {fired && " (fired)"}
      </span>
    </div>
  );
}

// ─── Subtasks Panel ────────────────────────────────────────────────────────────
function SubtasksPanel({ taskId }: { taskId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const { data: subtasks = [] } = useListSubtasks(taskId, {
    query: { queryKey: getListSubtasksQueryKey(taskId) }
  });
  const createSubtask = useCreateSubtask();
  const updateSubtask = useUpdateSubtask();
  const deleteSubtask = useDeleteSubtask();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListSubtasksQueryKey(taskId) });

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    createSubtask.mutate({ id: taskId, data: { title } }, {
      onSuccess: () => { setNewTitle(""); invalidate(); },
      onError: () => toast({ variant: "destructive", title: "Failed to add subtask" })
    });
  };

  const handleToggle = (subtaskId: number, completed: boolean) => {
    updateSubtask.mutate({ id: taskId, subtaskId, data: { completed } }, {
      onSuccess: invalidate,
      onError: () => toast({ variant: "destructive", title: "Failed to update subtask" })
    });
  };

  const handleRename = (subtaskId: number) => {
    const title = editingTitle.trim();
    if (!title) return;
    updateSubtask.mutate({ id: taskId, subtaskId, data: { title } }, {
      onSuccess: () => { setEditingId(null); invalidate(); },
      onError: () => toast({ variant: "destructive", title: "Failed to rename subtask" })
    });
  };

  const handleDelete = (subtaskId: number) => {
    deleteSubtask.mutate({ id: taskId, subtaskId }, {
      onSuccess: invalidate,
      onError: () => toast({ variant: "destructive", title: "Failed to delete subtask" })
    });
  };

  const completed = subtasks.filter((s) => s.completed).length;
  const total = subtasks.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Checklist
          </CardTitle>
          {total > 0 && (
            <span className="text-xs text-muted-foreground font-medium">
              {completed}/{total}
            </span>
          )}
        </div>
        {total > 0 && (
          <div className="w-full bg-muted rounded-full h-1.5 mt-2">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{ width: `${Math.round((completed / total) * 100)}%` }}
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {subtasks.map((s) => (
          <div key={s.id} className="flex items-center gap-2 group py-1 rounded hover:bg-muted/50 px-1 -mx-1">
            <button
              type="button"
              onClick={() => handleToggle(s.id, !s.completed)}
              className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
            >
              {s.completed
                ? <CheckSquare className="h-4 w-4 text-primary" />
                : <Square className="h-4 w-4" />
              }
            </button>

            {editingId === s.id ? (
              <div className="flex-1 flex gap-1">
                <Input
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleRename(s.id); if (e.key === "Escape") setEditingId(null); }}
                  className="h-6 text-sm py-0"
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleRename(s.id)}><Check className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
              </div>
            ) : (
              <span
                className={cn("flex-1 text-sm cursor-pointer", s.completed && "line-through text-muted-foreground")}
                onDoubleClick={() => { setEditingId(s.id); setEditingTitle(s.title); }}
              >
                {s.title}
              </span>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={() => handleDelete(s.id)}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}

        <div className="flex gap-2 pt-2">
          <Input
            placeholder="Add checklist item..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3 shrink-0"
            onClick={handleAdd}
            disabled={!newTitle.trim() || createSubtask.isPending}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Related Tasks Panel ───────────────────────────────────────────────────────
const RELATION_LABELS: Record<string, string> = {
  related: "Related to",
  blocks: "Blocks",
  blocked_by: "Blocked by",
  duplicates: "Duplicates",
};

function RelatedTasksPanel({ taskId }: { taskId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string>("");
  const [relationType, setRelationType] = useState<string>("related");

  const { data: relations = [] } = useListTaskRelations(taskId, {
    query: { queryKey: getListTaskRelationsQueryKey(taskId) }
  });
  const { data: allTasks = [] } = useListTasks({}, {
    query: { queryKey: getListTasksQueryKey() }
  });
  const createRelation = useCreateTaskRelation();
  const deleteRelation = useDeleteTaskRelation();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListTaskRelationsQueryKey(taskId) });

  const relatedIds = new Set(relations.map((r) => r.related_task_id));
  const linkableTasks = allTasks.filter((t) => t.id !== taskId && !relatedIds.has(t.id));

  const handleAdd = () => {
    if (!selectedTask) return;
    createRelation.mutate({
      id: taskId,
      data: {
        related_task_id: Number(selectedTask),
        relation_type: relationType as TaskRelationRelationType
      }
    }, {
      onSuccess: () => {
        setShowAdd(false);
        setSelectedTask("");
        setRelationType("related");
        invalidate();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to add relation" })
    });
  };

  const handleRemove = (relationId: number) => {
    deleteRelation.mutate({ id: taskId, relationId }, {
      onSuccess: invalidate,
      onError: () => toast({ variant: "destructive", title: "Failed to remove relation" })
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Related Tasks
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => setShowAdd((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Link
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {showAdd && (
          <div className="space-y-2 p-3 rounded-lg border bg-muted/30 mb-3">
            <Select value={relationType} onValueChange={setRelationType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="related">Related to</SelectItem>
                <SelectItem value="blocks">Blocks</SelectItem>
                <SelectItem value="blocked_by">Blocked by</SelectItem>
                <SelectItem value="duplicates">Duplicates</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedTask} onValueChange={setSelectedTask}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select a task..." />
              </SelectTrigger>
              <SelectContent>
                {linkableTasks.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    <span className="font-mono text-xs text-muted-foreground mr-1">{t.task_number}</span>
                    {t.task_title}
                  </SelectItem>
                ))}
                {linkableTasks.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No linkable tasks</div>
                )}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={!selectedTask || createRelation.isPending}>
                Add Link
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowAdd(false); setSelectedTask(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {relations.length === 0 && !showAdd && (
          <p className="text-xs text-muted-foreground py-1">No related tasks yet.</p>
        )}

        {relations.map((rel) => (
          <div key={rel.id} className="flex items-center gap-2 group py-1 rounded hover:bg-muted/40 px-1 -mx-1">
            <span className="text-xs text-muted-foreground w-20 shrink-0 italic">
              {RELATION_LABELS[rel.relation_type] ?? rel.relation_type}
            </span>
            <Link href={`/tasks/${rel.related_task_id}`} className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono text-xs text-muted-foreground shrink-0">{rel.related_task.task_number}</span>
                <span className="text-sm truncate hover:underline">{rel.related_task.task_title}</span>
              </div>
              <StatusBadge status={rel.related_task.status} statuses={[]} />
            </Link>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={() => handleRemove(rel.id)}
            >
              <Unlink className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
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
  const cloneTask = useCloneTask();

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
      } satisfies UpdateTaskBody
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

  const handleClone = () => {
    cloneTask.mutate({ id }, {
      onSuccess: (cloned) => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        toast({ title: `Task cloned as ${cloned.task_number}` });
        setLocation(`/tasks/${cloned.id}`);
      },
      onError: () => toast({ variant: "destructive", title: "Failed to clone task" })
    });
  };

  const onLogTime = (values: z.infer<typeof logTimeSchema>) => {
    logTime.mutate({ id, data: values }, {
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
          Reminder: {task.reminder_at ? format(new Date(task.reminder_at), "MMMM d, yyyy 'at' h:mm a") : ""} — don't forget this task!
        </div>
      )}

      {/* Header row */}
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleClone}
            disabled={cloneTask.isPending}
          >
            <Copy className="h-4 w-4 mr-2" />
            {cloneTask.isPending ? "Cloning..." : "Clone"}
          </Button>
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
        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title / description / edit form */}
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
                        <SelectTrigger><SelectValue /></SelectTrigger>
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
                        <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((s) => (
                            <SelectItem key={s.id} value={s.name}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Due Date</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !editDueDate && "text-muted-foreground")}>
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

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Reminder</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !editReminderAt && "text-muted-foreground")}>
                            {editReminderAt ? format(editReminderAt, "PPP 'at' h:mm a") : <span>Pick a date & time</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={editReminderAt || undefined}
                            onSelect={(d) => {
                              if (!d) { setEditReminderAt(null); return; }
                              const merged = new Date(d);
                              if (editReminderAt) { merged.setHours(editReminderAt.getHours(), editReminderAt.getMinutes()); }
                              else { merged.setHours(9, 0); }
                              setEditReminderAt(merged);
                            }}
                            initialFocus
                          />
                          <div className="p-3 border-t space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Time</label>
                            <input
                              type="time"
                              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              value={editReminderAt ? `${String(editReminderAt.getHours()).padStart(2, "0")}:${String(editReminderAt.getMinutes()).padStart(2, "0")}` : "09:00"}
                              onChange={(e) => {
                                const [h, m] = e.target.value.split(":").map(Number);
                                const base = editReminderAt ? new Date(editReminderAt) : new Date();
                                base.setHours(h, m, 0, 0);
                                setEditReminderAt(base);
                              }}
                              disabled={!editReminderAt}
                            />
                            {editReminderAt && (
                              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setEditReminderAt(null)}>Clear reminder</Button>
                            )}
                          </div>
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

          {/* Checklist */}
          <SubtasksPanel taskId={id} />

          {/* Related Tasks */}
          <RelatedTasksPanel taskId={id} />

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

        {/* ── Right column ── */}
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
