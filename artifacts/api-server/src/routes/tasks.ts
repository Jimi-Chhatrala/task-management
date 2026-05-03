import { Router } from "express";
import { db, tasksTable } from "@workspace/db";
import { eq, isNull, ilike, or, desc, asc, sql } from "drizzle-orm";
import {
  ListTasksQueryParams,
  CreateTaskBody,
  GetTaskParams,
  UpdateTaskBody,
  LogTimeBody,
} from "@workspace/api-zod";
import { parseTimeToMinutes, formatMinutesToReadable } from "../lib/time";

const router = Router();

function formatTask(task: typeof tasksTable.$inferSelect) {
  return {
    ...task,
    created_at: task.created_at.toISOString(),
    updated_at: task.updated_at.toISOString(),
    deleted_at: task.deleted_at?.toISOString() ?? null,
    time_spent_formatted: formatMinutesToReadable(task.time_spent_minutes),
  };
}

// GET /api/tasks
router.get("/tasks", async (req, res) => {
  const parsed = ListTasksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, priority, sortBy, sortOrder } = parsed.data;

  let query = db
    .select()
    .from(tasksTable)
    .where(isNull(tasksTable.deleted_at))
    .$dynamic();

  if (priority) {
    query = query.where(eq(tasksTable.priority, priority));
  }

  if (search) {
    query = query.where(
      or(
        ilike(tasksTable.task_title, `%${search}%`),
        ilike(tasksTable.task_number, `%${search}%`),
        ilike(tasksTable.task_description, `%${search}%`),
      ),
    );
  }

  const orderCol = (() => {
    switch (sortBy) {
      case "created_at":
        return tasksTable.created_at;
      case "updated_at":
        return tasksTable.updated_at;
      case "priority":
        return tasksTable.priority;
      case "production_live_date":
        return tasksTable.production_live_date;
      case "time_spent_minutes":
        return tasksTable.time_spent_minutes;
      case "task_number":
        return tasksTable.task_number;
      default:
        return tasksTable.created_at;
    }
  })();

  query = query.orderBy(sortOrder === "asc" ? asc(orderCol) : desc(orderCol));

  const tasks = await query;
  res.json(tasks.map(formatTask));
});

// GET /api/tasks/stats
router.get("/tasks/stats", async (req, res) => {
  const all = await db
    .select()
    .from(tasksTable)
    .where(isNull(tasksTable.deleted_at));

  const by_priority: Record<string, number> = {
    lowest: 0,
    low: 0,
    medium: 0,
    high: 0,
    highest: 0,
  };
  let total_time_minutes = 0;

  for (const t of all) {
    by_priority[t.priority] = (by_priority[t.priority] ?? 0) + 1;
    total_time_minutes += t.time_spent_minutes;
  }

  const recent_tasks = await db
    .select()
    .from(tasksTable)
    .where(isNull(tasksTable.deleted_at))
    .orderBy(desc(tasksTable.updated_at))
    .limit(5);

  res.json({
    total: all.length,
    by_priority,
    total_time_minutes,
    total_time_formatted: formatMinutesToReadable(total_time_minutes),
    recent_tasks: recent_tasks.map(formatTask),
  });
});

// GET /api/tasks/:id
router.get("/tasks/:id", async (req, res) => {
  const parsed = GetTaskParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid task ID" });
    return;
  }

  const [task] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, parsed.data.id));

  if (!task || task.deleted_at) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(formatTask(task));
});

// POST /api/tasks
router.post("/tasks", async (req, res) => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { time_input, ...rest } = parsed.data;

  let time_spent_minutes = 0;
  if (time_input) {
    try {
      time_spent_minutes = parseTimeToMinutes(time_input);
    } catch (e: unknown) {
      res.status(400).json({ error: e instanceof Error ? e.message : "Invalid time format" });
      return;
    }
  }

  const [task] = await db
    .insert(tasksTable)
    .values({ ...rest, time_spent_minutes })
    .returning();

  res.status(201).json(formatTask(task));
});

// PATCH /api/tasks/:id
router.patch("/tasks/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid task ID" });
    return;
  }

  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, id));

  if (!existing || existing.deleted_at) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const { time_input, ...rest } = parsed.data;

  const updates: Partial<typeof tasksTable.$inferInsert> = {
    ...rest,
    updated_at: new Date(),
  };

  if (time_input !== undefined) {
    try {
      updates.time_spent_minutes = parseTimeToMinutes(time_input ?? "");
    } catch (e: unknown) {
      res.status(400).json({ error: e instanceof Error ? e.message : "Invalid time format" });
      return;
    }
  }

  const [updated] = await db
    .update(tasksTable)
    .set(updates)
    .where(eq(tasksTable.id, id))
    .returning();

  res.json(formatTask(updated));
});

// DELETE /api/tasks/:id (soft delete)
router.delete("/tasks/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid task ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, id));

  if (!existing || existing.deleted_at) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  await db
    .update(tasksTable)
    .set({ deleted_at: new Date() })
    .where(eq(tasksTable.id, id));

  res.json({ message: "Task deleted" });
});

// POST /api/tasks/:id/log-time
router.post("/tasks/:id/log-time", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid task ID" });
    return;
  }

  const parsed = LogTimeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, id));

  if (!existing || existing.deleted_at) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  let additionalMinutes: number;
  try {
    additionalMinutes = parseTimeToMinutes(parsed.data.time_input);
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Invalid time format" });
    return;
  }

  const [updated] = await db
    .update(tasksTable)
    .set({
      time_spent_minutes: existing.time_spent_minutes + additionalMinutes,
      updated_at: new Date(),
    })
    .where(eq(tasksTable.id, id))
    .returning();

  res.json(formatTask(updated));
});

export default router;
