import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { 
  ArrowLeft, Clock, CalendarIcon, Edit2, Check, 
  X, Trash2, AlertTriangle, AlertCircle
} from "lucide-react";

import { 
  useGetTask, 
  useUpdateTask, 
  useDeleteTask, 
  useLogTime,
  getGetTaskQueryKey,
  getListTasksQueryKey,
  getGetTaskStatsQueryKey
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityBadge } from "@/components/priority-badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    setIsEditing(true);
  };

  const saveEdit = () => {
    updateTask.mutate({
      id,
      data: {
        task_title: editTitle,
        task_description: editDesc
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
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
        <div className="flex items-center gap-2">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="space-y-4">
            {isEditing ? (
              <Input 
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="text-2xl font-bold h-auto py-2"
                autoFocus
              />
            ) : (
              <h1 className="text-3xl font-bold tracking-tight">{task.task_title}</h1>
            )}
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <PriorityBadge priority={task.priority} />
              <span>Created {format(new Date(task.created_at), "MMM d, yyyy")}</span>
              {task.production_live_date && (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  Live: {format(new Date(task.production_live_date), "MMM d, yyyy")}
                </span>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-lg font-semibold mb-4">Description</h3>
            {isEditing ? (
              <div className="space-y-4">
                <RichTextEditor
                  value={editDesc}
                  onChange={setEditDesc}
                  placeholder="Add more details about this task..."
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit} disabled={updateTask.isPending}>
                    <Check className="h-4 w-4 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                    <X className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: task.task_description || "<p class='text-muted-foreground italic'>No description provided.</p>",
                }}
              />
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card className="border-primary/20 shadow-sm bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center text-primary">
                <Clock className="h-4 w-4 mr-2" />
                Time Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between mb-6">
                <div>
                  <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Logged</div>
                  <div className="text-2xl font-mono font-bold">{task.time_spent_formatted}</div>
                </div>
              </div>

              <Form {...timeForm}>
                <form onSubmit={timeForm.handleSubmit(onLogTime)} className="space-y-3">
                  <FormField
                    control={timeForm.control}
                    name="time_input"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Add Time</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input placeholder="e.g. 2h 30m" className="bg-background" {...field} />
                          </FormControl>
                          <Button type="submit" size="sm" disabled={logTime.isPending}>
                            Log
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">ID</span>
                <span className="font-mono">{task.task_number}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Priority</span>
                <span className="capitalize font-medium">{task.priority}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">Open</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/50">
                <span className="text-muted-foreground">Updated</span>
                <span>{format(new Date(task.updated_at), "MMM d")}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
