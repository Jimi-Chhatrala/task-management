import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Paperclip, Trash2, Download, Upload, Loader2, File, Image, FileText, FileArchive, FileCode } from "lucide-react";
import {
  useListTaskAttachments,
  useCreateTaskAttachment,
  useDeleteTaskAttachment,
  getListTaskAttachmentsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function fileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return <Image className="h-4 w-4 shrink-0 text-blue-500" />;
  if (contentType.startsWith("text/")) return <FileText className="h-4 w-4 shrink-0 text-green-500" />;
  if (contentType.includes("zip") || contentType.includes("archive") || contentType.includes("tar"))
    return <FileArchive className="h-4 w-4 shrink-0 text-yellow-500" />;
  if (contentType.includes("json") || contentType.includes("javascript") || contentType.includes("html"))
    return <FileCode className="h-4 w-4 shrink-0 text-purple-500" />;
  return <File className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

async function uploadFile(file: File): Promise<{ objectPath: string }> {
  const presignRes = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
  });
  if (!presignRes.ok) throw new Error("Failed to get upload URL");
  const { uploadURL, objectPath } = await presignRes.json() as { uploadURL: string; objectPath: string };

  const putRes = await fetch(uploadURL, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!putRes.ok) throw new Error("Upload failed");
  return { objectPath };
}

interface TaskAttachmentsProps {
  taskId: number;
}

export function TaskAttachments({ taskId }: TaskAttachmentsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const { data: attachments = [], isLoading } = useListTaskAttachments(taskId, {
    query: { queryKey: getListTaskAttachmentsQueryKey(taskId) },
  });

  const createAttachment = useCreateTaskAttachment();
  const deleteAttachment = useDeleteTaskAttachment();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (const file of Array.from(files)) {
      try {
        const { objectPath } = await uploadFile(file);
        await createAttachment.mutateAsync({
          id: taskId,
          data: {
            file_name: file.name,
            file_size: file.size,
            content_type: file.type || "application/octet-stream",
            object_path: objectPath,
          },
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    await queryClient.invalidateQueries({ queryKey: getListTaskAttachmentsQueryKey(taskId) });
    setUploading(false);

    if (successCount > 0) {
      toast({ title: `${successCount} file${successCount > 1 ? "s" : ""} uploaded` });
    }
    if (failCount > 0) {
      toast({ variant: "destructive", title: `${failCount} file${failCount > 1 ? "s" : ""} failed to upload` });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = (attachmentId: number) => {
    deleteAttachment.mutate(
      { id: taskId, attachmentId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTaskAttachmentsQueryKey(taskId) });
          toast({ title: "Attachment deleted" });
        },
        onError: () => toast({ variant: "destructive", title: "Failed to delete attachment" }),
      }
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Drop zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg px-4 py-5 text-center cursor-pointer transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading...
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Click to upload</span> or drag & drop
            </p>
            <p className="text-xs text-muted-foreground">Any file type supported</p>
          </div>
        )}
      </div>

      {/* Attachment list */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-2">Loading attachments...</div>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-1">No attachments yet</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm group"
            >
              {fileIcon(a.content_type)}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium leading-tight">{a.file_name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(a.file_size)}</p>
              </div>
              <a
                href={`/api/storage${a.object_path}`}
                download={a.file_name}
                target="_blank"
                rel="noreferrer"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Download">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                title="Delete"
                onClick={() => handleDelete(a.id)}
                disabled={deleteAttachment.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
