import { Router } from "express";
import { db, tasksTable, taskSubtasksTable } from "@workspace/db";
import { eq, isNull, and, asc, max } from "drizzle-orm";
import { z } from "zod";

const router = Router({ mergeParams: true });

const CreateSubtaskBody = z.object({ title: z.string().min(1) });
const UpdateSubtaskBody = z.object({
  title: z.string().min(1).optional(),
  completed: z.boolean().optional(),
});

function formatSubtask(s: typeof taskSubtasksTable.$inferSelect) {
  return {
    ...s,
    created_at: s.created_at.toISOString(),
    updated_at: s.updated_at.toISOString(),
  };
}

// GET /api/tasks/:id/subtasks
router.get("/", async (req, res) => {
  const taskId = Number((req.params as any).id);
  if (isNaN(taskId)) { res.status(400).json({ error: "Invalid task ID" }); return; }

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
  if (!task || task.deleted_at) { res.status(404).json({ error: "Task not found" }); return; }

  const subtasks = await db
    .select()
    .from(taskSubtasksTable)
    .where(eq(taskSubtasksTable.task_id, taskId))
    .orderBy(asc(taskSubtasksTable.position), asc(taskSubtasksTable.created_at));

  res.json(subtasks.map(formatSubtask));
});

// POST /api/tasks/:id/subtasks
router.post("/", async (req, res) => {
  const taskId = Number((req.params as any).id);
  if (isNaN(taskId)) { res.status(400).json({ error: "Invalid task ID" }); return; }

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
  if (!task || task.deleted_at) { res.status(404).json({ error: "Task not found" }); return; }

  const parsed = CreateSubtaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [maxPos] = await db
    .select({ maxPos: max(taskSubtasksTable.position) })
    .from(taskSubtasksTable)
    .where(eq(taskSubtasksTable.task_id, taskId));

  const position = (maxPos?.maxPos ?? -1) + 1;

  const [subtask] = await db
    .insert(taskSubtasksTable)
    .values({ task_id: taskId, title: parsed.data.title, position })
    .returning();

  res.status(201).json(formatSubtask(subtask));
});

// PATCH /api/tasks/:id/subtasks/:subtaskId
router.patch("/:subtaskId", async (req, res) => {
  const taskId = Number((req.params as any).id);
  const subtaskId = Number(req.params.subtaskId);
  if (isNaN(taskId) || isNaN(subtaskId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = UpdateSubtaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db
    .select()
    .from(taskSubtasksTable)
    .where(and(eq(taskSubtasksTable.id, subtaskId), eq(taskSubtasksTable.task_id, taskId)));

  if (!existing) { res.status(404).json({ error: "Subtask not found" }); return; }

  const updates: Partial<typeof taskSubtasksTable.$inferInsert> = {
    updated_at: new Date(),
  };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.completed !== undefined) updates.completed = parsed.data.completed;

  const [updated] = await db
    .update(taskSubtasksTable)
    .set(updates)
    .where(eq(taskSubtasksTable.id, subtaskId))
    .returning();

  res.json(formatSubtask(updated));
});

// DELETE /api/tasks/:id/subtasks/:subtaskId
router.delete("/:subtaskId", async (req, res) => {
  const taskId = Number((req.params as any).id);
  const subtaskId = Number(req.params.subtaskId);
  if (isNaN(taskId) || isNaN(subtaskId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existing] = await db
    .select()
    .from(taskSubtasksTable)
    .where(and(eq(taskSubtasksTable.id, subtaskId), eq(taskSubtasksTable.task_id, taskId)));

  if (!existing) { res.status(404).json({ error: "Subtask not found" }); return; }

  await db.delete(taskSubtasksTable).where(eq(taskSubtasksTable.id, subtaskId));
  res.json({ message: "Subtask deleted" });
});

export default router;
