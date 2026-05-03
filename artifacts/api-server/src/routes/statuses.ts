import { Router } from "express";
import { db, taskStatusesTable, tasksTable } from "@workspace/db";
import { eq, isNull, count } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const DEFAULT_STATUSES = [
  { name: "todo", label: "Todo", color: "#6b7280", position: 0, is_default: true },
  { name: "in_progress", label: "In Progress", color: "#3b82f6", position: 1, is_default: false },
  { name: "testing", label: "Testing", color: "#f59e0b", position: 2, is_default: false },
  { name: "blocked", label: "Blocked", color: "#ef4444", position: 3, is_default: false },
  { name: "done", label: "Done", color: "#22c55e", position: 4, is_default: false },
];

export async function seedDefaultStatuses() {
  const existing = await db.select().from(taskStatusesTable);
  if (existing.length === 0) {
    await db.insert(taskStatusesTable).values(DEFAULT_STATUSES);
  }
}

// GET /api/statuses
router.get("/statuses", async (req, res) => {
  const statuses = await db
    .select()
    .from(taskStatusesTable)
    .orderBy(taskStatusesTable.position);
  res.json(statuses);
});

const CreateStatusBody = z.object({
  name: z.string().min(1).regex(/^[a-z0-9_]+$/, "Name must be lowercase letters, numbers, or underscores"),
  label: z.string().min(1),
  color: z.string().default("#6b7280"),
  position: z.number().int().optional(),
  is_default: z.boolean().default(false),
});

// POST /api/statuses
router.post("/statuses", async (req, res) => {
  const parsed = CreateStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(taskStatusesTable)
    .where(eq(taskStatusesTable.name, parsed.data.name));

  if (existing.length > 0) {
    res.status(400).json({ error: `Status with name "${parsed.data.name}" already exists` });
    return;
  }

  const allStatuses = await db.select().from(taskStatusesTable);
  const position = parsed.data.position ?? allStatuses.length;

  if (parsed.data.is_default) {
    await db.update(taskStatusesTable).set({ is_default: false });
  }

  const [status] = await db
    .insert(taskStatusesTable)
    .values({ ...parsed.data, position })
    .returning();

  res.status(201).json(status);
});

const UpdateStatusBody = z.object({
  label: z.string().min(1).optional(),
  color: z.string().optional(),
  position: z.number().int().optional(),
  is_default: z.boolean().optional(),
});

const StatusIdParams = z.object({ id: z.number().int().positive() });

// PATCH /api/statuses/:id
router.patch("/statuses/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid status ID" });
    return;
  }

  const parsed = UpdateStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(taskStatusesTable)
    .where(eq(taskStatusesTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Status not found" });
    return;
  }

  if (parsed.data.is_default) {
    await db.update(taskStatusesTable).set({ is_default: false });
  }

  const [updated] = await db
    .update(taskStatusesTable)
    .set(parsed.data)
    .where(eq(taskStatusesTable.id, id))
    .returning();

  res.json(updated);
});

// DELETE /api/statuses/:id
router.delete("/statuses/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid status ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(taskStatusesTable)
    .where(eq(taskStatusesTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Status not found" });
    return;
  }

  const [{ usedCount }] = await db
    .select({ usedCount: count() })
    .from(tasksTable)
    .where(eq(tasksTable.status, existing.name));

  if (Number(usedCount) > 0) {
    res.status(400).json({
      error: `Cannot delete status "${existing.label}" — it is used by ${usedCount} task(s). Reassign those tasks first.`,
    });
    return;
  }

  await db.delete(taskStatusesTable).where(eq(taskStatusesTable.id, id));
  res.json({ message: "Status deleted" });
});

export default router;
