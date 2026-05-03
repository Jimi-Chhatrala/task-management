import { Router } from "express";
import { db, tasksTable, taskAttachmentsTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const CreateAttachmentBody = z.object({
  file_name: z.string().min(1),
  file_size: z.number().int().nonnegative().default(0),
  content_type: z.string().default("application/octet-stream"),
  object_path: z.string().min(1),
});

async function getTaskOrFail(id: number, res: any): Promise<boolean> {
  const [task] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, id));
  if (!task || task.deleted_at) {
    res.status(404).json({ error: "Task not found" });
    return false;
  }
  return true;
}

// GET /api/tasks/:id/attachments
router.get("/tasks/:id/attachments", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid task ID" });
    return;
  }

  if (!(await getTaskOrFail(id, res))) return;

  const attachments = await db
    .select()
    .from(taskAttachmentsTable)
    .where(eq(taskAttachmentsTable.task_id, id))
    .orderBy(taskAttachmentsTable.created_at);

  res.json(
    attachments.map((a) => ({
      ...a,
      created_at: a.created_at.toISOString(),
    }))
  );
});

// POST /api/tasks/:id/attachments
router.post("/tasks/:id/attachments", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid task ID" });
    return;
  }

  if (!(await getTaskOrFail(id, res))) return;

  const parsed = CreateAttachmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [attachment] = await db
    .insert(taskAttachmentsTable)
    .values({ task_id: id, ...parsed.data })
    .returning();

  res.status(201).json({
    ...attachment,
    created_at: attachment.created_at.toISOString(),
  });
});

// DELETE /api/tasks/:id/attachments/:attachmentId
router.delete("/tasks/:id/attachments/:attachmentId", async (req, res) => {
  const taskId = Number(req.params.id);
  const attachmentId = Number(req.params.attachmentId);
  if (isNaN(taskId) || isNaN(attachmentId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(taskAttachmentsTable)
    .where(eq(taskAttachmentsTable.id, attachmentId));

  if (!existing || existing.task_id !== taskId) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }

  await db
    .delete(taskAttachmentsTable)
    .where(eq(taskAttachmentsTable.id, attachmentId));

  res.json({ message: "Attachment deleted" });
});

export default router;
