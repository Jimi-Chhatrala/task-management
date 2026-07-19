import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { CalendarIcon, ArrowLeft } from "lucide-react";
import {
  useCreateTask,
  useListStatuses,
  useCreateTaskAttachment,
  getListTasksQueryKey,
  getGetTaskStatsQueryKey,
  CreateTaskBodyPriority,
} from "@workspace/api-client-react";
import type { CreateTaskBody } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/rich-text-editor";
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
import { Card, CardContent } from "@/components/ui/card";
import { NewTaskAttachments, type PendingAttachment } from "@/components/new-task-attachments";

const formSchema = z.object({
  task_title: z.string().min(1, "Title is required").max(255),
  task_description: z.string().optional(),
  priority: z.enum(["lowest", "low", "medium", "high", "highest"]),
  status: z.string().min(1, "Status is required"),
  due_date: z.date().optional().nullable(),
  reminder_at: z.date().optional().nullable(),
  production_live_date: z.date().optional().nullable(),
  time_input: z.string().optional().refine(val => !val || /^(?:\d+[dhm]\s*)+$/.test(val), {
    message: "Invalid format. Use 1d 2h 30m"
  }),
});

export default function NewTask() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const createAttachment = useCreateTaskAttachment();
  const { data: statuses } = useListStatuses();
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  const defaultStatus = statuses?.find((s) => s.is_default)?.name ?? statuses?.[0]?.name ?? "todo";

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      task_title: "",
      task_description: "",
      priority: "medium",
      status: defaultStatus,
      time_input: "",
    },
  });

  const currentStatus = form.watch("status");
  if (statuses && statuses.length > 0 && !currentStatus) {
    form.setValue("status", defaultStatus);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    createTask.mutate({
      data: {
        task_title: values.task_title,
        task_description: values.task_description,
        priority: values.priority as keyof typeof CreateTaskBodyPriority,
        status: values.status,
        production_live_date: values.production_live_date ? values.production_live_date.toISOString() : null,
        due_date: values.due_date ? values.due_date.toISOString() : null,
        reminder_at: values.reminder_at ? values.reminder_at.toISOString() : null,
        time_input: values.time_input,
      } satisfies CreateTaskBody
    }, {
      onSuccess: async (task) => {
        if (pendingAttachments.length > 0) {
          let failed = false;
          for (const item of pendingAttachments) {
            try {
              const uploadRes = await fetch("/api/storage/uploads/request-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: item.file.name, size: item.file.size, contentType: item.file.type || "application/octet-stream" }),
              });
              if (!uploadRes.ok) throw new Error("Failed to get upload URL");
              const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };
              const putRes = await fetch(uploadURL, {
                method: "PUT",
                body: item.file,
                headers: { "Content-Type": item.file.type || "application/octet-stream" },
              });
              if (!putRes.ok) throw new Error("Upload failed");
              await createAttachment.mutateAsync({
                id: task.id,
                data: {
                  file_name: item.file.name,
                  file_size: item.file.size,
                  content_type: item.file.type || "application/octet-stream",
                  object_path: objectPath,
                },
              });
            } catch {
              failed = true;
            }
          }
          if (failed) {
            toast({ variant: "destructive", title: "Task created but attachment upload failed" });
          }
        }
        toast({
          title: "Task created",
          description: `${task.task_number} was created successfully.`,
        });
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTaskStatsQueryKey() });
        setLocation(`/tasks/${task.id}`);
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to create task.",
        });
      }
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link href="/">
          <Button variant="outline" size="icon" className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Create Task</h1>
          <p className="text-muted-foreground text-sm">A task number will be assigned automatically.</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <FormField
                  control={form.control}
                  name="task_title"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="What needs to be done?" {...field} data-testid="input-task-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-priority">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="highest">Highest</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="lowest">Lowest</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statuses?.map((s: { id: number; name: string; color: string; label: string }) => (
                            <SelectItem key={s.id} value={s.name}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full"
                                  style={{ backgroundColor: s.color }}
                                />
                                {s.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Due Date */}
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Due Date (Optional)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value || undefined}
                            onSelect={field.onChange}
                            initialFocus
                          />
                          {field.value && (
                            <div className="p-2 border-t">
                              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => field.onChange(null)}>
                                Clear date
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Reminder */}
                <FormField
                  control={form.control}
                  name="reminder_at"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Reminder (Optional)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? format(field.value, "PPP 'at' h:mm a") : <span>Pick a date & time</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value || undefined}
                            onSelect={(d) => {
                              if (!d) { field.onChange(null); return; }
                              const prev = field.value;
                              const merged = new Date(d);
                              if (prev) { merged.setHours(prev.getHours(), prev.getMinutes()); }
                              else { merged.setHours(9, 0); }
                              field.onChange(merged);
                            }}
                            initialFocus
                          />
                          <div className="p-3 border-t space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">Time</label>
                            <input
                              type="time"
                              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              value={field.value ? `${String(field.value.getHours()).padStart(2, "0")}:${String(field.value.getMinutes()).padStart(2, "0")}` : "09:00"}
                              onChange={(e) => {
                                const [h, m] = e.target.value.split(":").map(Number);
                                const base = field.value ? new Date(field.value) : new Date();
                                base.setHours(h, m, 0, 0);
                                field.onChange(base);
                              }}
                              disabled={!field.value}
                            />
                            {field.value && (
                              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => field.onChange(null)}>
                                Clear reminder
                              </Button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <FormDescription className="text-xs">Shows an in-app alert when this date arrives</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="time_input"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Time Logged (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 1h 30m" {...field} />
                      </FormControl>
                      <FormDescription>Use Jira-style: 1d 2h 30m (1 day = 8h)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="task_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Describe the task in detail..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <h3 className="text-sm font-medium mb-3">Attachments (Optional)</h3>
                <NewTaskAttachments files={pendingAttachments} setFiles={setPendingAttachments} />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button type="submit" disabled={createTask.isPending} className="flex-1">
                  {createTask.isPending ? "Creating..." : "Create Task"}
                </Button>
                <Link href="/">
                  <Button type="button" variant="outline">Cancel</Button>
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
