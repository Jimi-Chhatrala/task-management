import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { CalendarIcon, ArrowLeft } from "lucide-react";
import { useCreateTask, getListTasksQueryKey, getGetTaskStatsQueryKey } from "@workspace/api-client-react";
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
import { Textarea } from "@/components/ui/textarea";
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

const formSchema = z.object({
  task_title: z.string().min(1, "Title is required").max(255),
  task_description: z.string().optional(),
  priority: z.enum(["lowest", "low", "medium", "high", "highest"]),
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      task_title: "",
      task_description: "",
      priority: "medium",
      time_input: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createTask.mutate({
      data: {
        ...values,
        production_live_date: values.production_live_date ? values.production_live_date.toISOString() : null,
      }
    }, {
      onSuccess: (task) => {
        toast({
          title: "Task created",
          description: `${task.task_number} was created successfully.`,
        });
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTaskStatsQueryKey() });
        setLocation(`/tasks/${task.id}`);
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.error || "Failed to create task.",
        });
      }
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="outline" size="icon" className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Task</h1>
          <p className="text-muted-foreground text-sm">A task number will be assigned automatically.</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  name="production_live_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Production Live Date (Optional)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="button-live-date"
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value || undefined}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date("1900-01-01")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add more details about this task..."
                        className="min-h-[120px] resize-y"
                        {...field}
                        data-testid="input-task-description"
                      />
                    </FormControl>
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
                      <Input placeholder="e.g. 1d 2h 30m" {...field} data-testid="input-time" />
                    </FormControl>
                    <FormDescription>Jira-style format: d = day (8h), h = hour, m = minute</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-4 pt-4 border-t border-border">
                <Link href="/">
                  <Button variant="outline" type="button" data-testid="button-cancel">Cancel</Button>
                </Link>
                <Button type="submit" disabled={createTask.isPending} data-testid="button-submit">
                  {createTask.isPending ? "Creating..." : "Create Task"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
