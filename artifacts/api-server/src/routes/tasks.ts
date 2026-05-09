import { Router } from "express";
import { db, tasksTable, taskNotificationsTable } from "@workspace/db";
import { eq, isNull, ilike, or, desc, asc, max, lt, and, isNotNull } from "drizzle-orm";
import {
  ListTasksQueryParams,
  CreateTaskBody,
  GetTaskParams,
  UpdateTaskBody,
  LogTimeBody,
} from "@workspace/api-zod";
import { parseTimeToMinutes, formatMinutesToReadable } from "../lib/time";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

function isTaskOverdue(task: typeof tasksTable.$inferSelect): boolean {
  if (!task.due_date) return false;
  if (task.status === "done") return false;
  return task.due_date < new Date();
}

function formatTask(task: typeof tasksTable.$inferSelect) {
  return {
    ...task,
    due_date: task.due_date?.toISOString() ?? null,
    reminder_at: task.reminder_at?.toISOString() ?? null,
    is_overdue: isTaskOverdue(task),
    created_at: task.created_at.toISOString(),
    updated_at: task.updated_at.toISOString(),
    deleted_at: task.deleted_at?.toISOString() ?? null,
    time_spent_formatted: formatMinutesToReadable(task.time_spent_minutes),
  };
}

// GET /api/tasks
router.get("/tasks", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parsed = ListTasksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, priority, status, sortBy, sortOrder, overdue } = parsed.data as any;

  let query = db
    .select()
    .from(tasksTable)
    .where(and(isNull(tasksTable.deleted_at), eq(tasksTable.user_id, userId)))
    .$dynamic();

  if (priority) {
    query = query.where(eq(tasksTable.priority, priority));
  }

  if (status) {
    query = query.where(eq(tasksTable.status, status));
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

  if (overdue === "true") {
    const now = new Date();
    query = query.where(
      and(
        isNotNull(tasksTable.due_date),
        lt(tasksTable.due_date, now),
      )
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
      case "status":
        return tasksTable.status;
      case "production_live_date":
        return tasksTable.production_live_date;
      case "due_date":
        return tasksTable.due_date;
      case "time_spent_minutes":
        return tasksTable.time_spent_minutes;
      case "task_number":
        return tasksTable.task_number;
      default:
        return tasksTable.updated_at;
    }
  })();

  query = query.orderBy(sortOrder === "asc" ? asc(orderCol) : desc(orderCol));

  const tasks = await query;
  res.json(tasks.map(formatTask));
});

// GET /api/tasks/stats
router.get("/tasks/stats", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const all = await db
    .select()
    .from(tasksTable)
    .where(and(isNull(tasksTable.deleted_at), eq(tasksTable.user_id, userId)));

  const by_priority: Record<string, number> = {
    lowest: 0,
    low: 0,
    medium: 0,
    high: 0,
    highest: 0,
  };
  const by_status: Record<string, number> = {};
  let total_time_minutes = 0;
  let overdue_count = 0;

  for (const t of all) {
    by_priority[t.priority] = (by_priority[t.priority] ?? 0) + 1;
    by_status[t.status] = (by_status[t.status] ?? 0) + 1;
    total_time_minutes += t.time_spent_minutes;
    if (isTaskOverdue(t)) overdue_count++;
  }

  const recent_tasks = await db
    .select()
    .from(tasksTable)
    .where(and(isNull(tasksTable.deleted_at), eq(tasksTable.user_id, userId)))
    .orderBy(desc(tasksTable.updated_at))
    .limit(5);

  res.json({
    total: all.length,
    by_priority,
    by_status,
    total_time_minutes,
    total_time_formatted: formatMinutesToReadable(total_time_minutes),
    overdue_count,
    recent_tasks: recent_tasks.map(formatTask),
  });
});

// GET /api/tasks/:id
router.get("/tasks/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parsed = GetTaskParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid task ID" });
    return;
  }

  const [task] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, parsed.data.id), eq(tasksTable.user_id, userId)));

  if (!task || task.deleted_at) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(formatTask(task));
});

// POST /api/tasks
router.post("/tasks", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { time_input, due_date, reminder_at, ...rest } = parsed.data as any;

  let time_spent_minutes = 0;
  if (time_input) {
    try {
      time_spent_minutes = parseTimeToMinutes(time_input);
    } catch (e: unknown) {
      res.status(400).json({ error: e instanceof Error ? e.message : "Invalid time format" });
      return;
    }
  }

  const [result] = await db
    .select({ maxId: max(tasksTable.id) })
    .from(tasksTable)
    .where(eq(tasksTable.user_id, userId));
  const nextNum = (result?.maxId ?? 0) + 1;
  const task_number = `TASK-${String(nextNum).padStart(3, "0")}`;

  const [task] = await db
    .insert(tasksTable)
    .values({
      ...rest,
      user_id: userId,
      task_number,
      time_spent_minutes,
      due_date: due_date ? new Date(due_date) : null,
      reminder_at: reminder_at ? new Date(reminder_at) : null,
    })
    .returning();

  await db.insert(taskNotificationsTable).values({
    user_id: userId,
    task_id: task.id,
    type: "task_created",
    message: `Task ${task.task_number} was created: "${task.task_title}"`,
  });

  res.status(201).json(formatTask(task));
});

// PATCH /api/tasks/:id
router.patch("/tasks/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
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
    .where(and(eq(tasksTable.id, id), eq(tasksTable.user_id, userId)));

  if (!existing || existing.deleted_at) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const { time_input, status, due_date, reminder_at, ...rest } = parsed.data as any;
  const nextStatus = status ?? existing.status;

  const updates: Partial<typeof tasksTable.$inferInsert> = {
    ...rest,
    status: nextStatus,
    production_live_date:
      nextStatus === "done"
        ? existing.production_live_date ?? new Date().toISOString().slice(0, 10)
        : null,
    updated_at: new Date(),
  };

  if (due_date !== undefined) {
    updates.due_date = due_date ? new Date(due_date) : null;
  }

  if (reminder_at !== undefined) {
    updates.reminder_at = reminder_at ? new Date(reminder_at) : null;
  }

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
    .where(and(eq(tasksTable.id, id), eq(tasksTable.user_id, userId)))
    .returning();

  if (nextStatus !== existing.status) {
    await db.insert(taskNotificationsTable).values({
      user_id: userId,
      task_id: updated.id,
      type: "status_changed",
      message: `${updated.task_number} status changed from "${existing.status}" to "${nextStatus}"`,
    });
  }

  res.json(formatTask(updated));
});

// DELETE /api/tasks/:id (soft delete)
router.delete("/tasks/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid task ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.user_id, userId)));

  if (!existing || existing.deleted_at) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  await db
    .update(tasksTable)
    .set({ deleted_at: new Date() })
    .where(and(eq(tasksTable.id, id), eq(tasksTable.user_id, userId)));

  res.json({ message: "Task deleted" });
});

// POST /api/tasks/:id/log-time
router.post("/tasks/:id/log-time", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
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
    .where(and(eq(tasksTable.id, id), eq(tasksTable.user_id, userId)));

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
    .where(and(eq(tasksTable.id, id), eq(tasksTable.user_id, userId)))
    .returning();

  res.json(formatTask(updated));
});

// POST /api/tasks/:id/clone
router.post("/tasks/:id/clone", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid task ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, id), eq(tasksTable.user_id, userId)));

  if (!existing || existing.deleted_at) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const [result] = await db
    .select({ maxId: max(tasksTable.id) })
    .from(tasksTable)
    .where(eq(tasksTable.user_id, userId));
  const nextNum = (result?.maxId ?? 0) + 1;
  const task_number = `TASK-${String(nextNum).padStart(3, "0")}`;

  const [cloned] = await db
    .insert(tasksTable)
    .values({
      user_id: userId,
      task_number,
      task_title: `${existing.task_title} (Copy)`,
      task_description: existing.task_description,
      priority: existing.priority,
      status: existing.status,
      time_spent_minutes: 0,
    })
    .returning();

  res.status(201).json(formatTask(cloned));
});

export default router;
