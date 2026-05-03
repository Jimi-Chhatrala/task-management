import { useRef, useState } from "react";
import { Upload, Trash2, File, Image, FileText, FileArchive, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PendingAttachment = {
  file: File;
  localId: string;
};

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
  if (contentType.includes("zip") || contentType.includes("archive") || contentType.includes("tar")) return <FileArchive className="h-4 w-4 shrink-0 text-yellow-500" />;
  if (contentType.includes("json") || contentType.includes("javascript") || contentType.includes("html")) return <FileCode className="h-4 w-4 shrink-0 text-purple-500" />;
  return <File className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

interface NewTaskAttachmentsProps {
  files: PendingAttachment[];
  setFiles: (files: PendingAttachment[] | ((prev: PendingAttachment[]) => PendingAttachment[])) => void;
}

export function NewTaskAttachments({ files, setFiles }: NewTaskAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = (selected: FileList | null) => {
    if (!selected || selected.length === 0) return;
    setFiles((prev) => [
      ...prev,
      ...Array.from(selected).map((file) => ({ file, localId: crypto.randomUUID() })),
    ]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />

      <div
        className={cn(
          "border-2 border-dashed rounded-lg px-4 py-5 text-center cursor-pointer transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex flex-col items-center gap-1">
          <Upload className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Add attachments</span> before creating the task
          </p>
          <p className="text-xs text-muted-foreground">Any file type supported</p>
        </div>
      </div>

      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((item) => (
            <li key={item.localId} className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm group">
              {fileIcon(item.file.type || "application/octet-stream")}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium leading-tight">{item.file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Remove" onClick={() => setFiles((prev) => prev.filter((f) => f.localId !== item.localId))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
