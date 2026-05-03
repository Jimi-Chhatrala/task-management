import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Trash2, Plus, GripVertical, Pencil, Check, X } from "lucide-react";
import {
  useListStatuses,
  useCreateStatus,
  useUpdateStatus,
  useDeleteStatus,
  getListStatusesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const createStatusSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores"),
  label: z.string().min(1, "Label is required"),
  color: z.string().default("#6b7280"),
  is_default: z.boolean().default(false),
});

type CreateStatusForm = z.infer<typeof createStatusSchema>;

const PRESET_COLORS = [
  "#6b7280", "#3b82f6", "#22c55e", "#ef4444",
  "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6",
  "#f97316", "#06b6d4",
];

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: statuses, isLoading } = useListStatuses();
  const createStatus = useCreateStatus();
  const updateStatus = useUpdateStatus();
  const deleteStatus = useDeleteStatus();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("");

  const form = useForm<CreateStatusForm>({
    resolver: zodResolver(createStatusSchema),
    defaultValues: {
      name: "",
      label: "",
      color: "#6b7280",
      is_default: false,
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListStatusesQueryKey() });

  function onSubmit(values: CreateStatusForm) {
    createStatus.mutate(
      { data: { ...values, position: statuses?.length ?? 0 } },
      {
        onSuccess: () => {
          toast({ title: "Status created" });
          form.reset();
          invalidate();
        },
        onError: (err: any) =>
          toast({
            variant: "destructive",
            title: "Error",
            description: err.error || "Failed to create status",
          }),
      },
    );
  }

  function startEdit(status: { id: number; label: string; color: string }) {
    setEditingId(status.id);
    setEditLabel(status.label);
    setEditColor(status.color);
  }

  function saveEdit(id: number) {
    updateStatus.mutate(
      { id, data: { label: editLabel, color: editColor } },
      {
        onSuccess: () => {
          setEditingId(null);
          toast({ title: "Status updated" });
          invalidate();
        },
        onError: (err: any) =>
          toast({
            variant: "destructive",
            title: "Error",
            description: err.error || "Failed to update status",
          }),
      },
    );
  }

  function handleSetDefault(id: number) {
    updateStatus.mutate(
      { id, data: { is_default: true } },
      {
        onSuccess: () => {
          toast({ title: "Default status updated" });
          invalidate();
        },
      },
    );
  }

  function handleDelete(id: number) {
    deleteStatus.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Status deleted" });
          invalidate();
        },
        onError: (err: any) =>
          toast({
            variant: "destructive",
            title: "Cannot delete",
            description: err.error || "Failed to delete status",
          }),
      },
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your workflow statuses.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Task Statuses</CardTitle>
          <CardDescription>
            Add, rename, recolor, or remove statuses. The default status is
            assigned to new tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-2">
              {statuses?.map((status) => (
                <div
                  key={status.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 opacity-40" />

                  {editingId === status.id ? (
                    <>
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-border shrink-0"
                        title="Pick a color"
                      />
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="h-8 text-sm flex-1"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(status.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={() => saveEdit(status.id)}
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: status.color }}
                      />
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium">{status.label}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {status.name}
                        </span>
                        {status.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!status.is_default && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs px-2 text-muted-foreground"
                            onClick={() => handleSetDefault(status.id)}
                          >
                            Set default
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => startEdit(status)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete status?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the "{status.label}"
                                status. You cannot delete a status that is
                                currently used by tasks.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDelete(status.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-border pt-4 mt-4">
            <h3 className="text-sm font-semibold mb-3">Add New Status</h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Key (slug)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. in_review" {...field} />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Lowercase, underscores only
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Label</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. In Review" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={field.value}
                          onChange={field.onChange}
                          className="w-10 h-9 rounded border border-border cursor-pointer"
                        />
                        <div className="flex gap-2 flex-wrap">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => field.onChange(c)}
                              className="w-6 h-6 rounded-full border-2 transition-all"
                              style={{
                                backgroundColor: c,
                                borderColor:
                                  field.value === c ? "#000" : "transparent",
                              }}
                              title={c}
                            />
                          ))}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_default"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div>
                        <FormLabel className="cursor-pointer">
                          Set as default status
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Applied to new tasks automatically
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={createStatus.isPending}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Status
                </Button>
              </form>
            </Form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
