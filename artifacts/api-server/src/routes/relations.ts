import { Router } from "express";
import { db, tasksTable, taskRelationsTable } from "@workspace/db";
import { eq, isNull, and, or } from "drizzle-orm";
import { z } from "zod";

const router = Router({ mergeParams: true });

const CreateTaskRelationBody = z.object({
  related_task_id: z.number().int().positive(),
  relation_type: z.enum(["related", "blocks", "blocked_by", "duplicates"]).default("related"),
});

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
    time_spent_formatted: formatMinutes(task.time_spent_minutes),
  };
}

function formatMinutes(minutes: number): string {
  if (minutes === 0) return "0m";
  const d = Math.floor(minutes / 480);
  const h = Math.floor((minutes % 480) / 60);
  const m = minutes % 60;
  return [d > 0 ? `${d}d` : "", h > 0 ? `${h}h` : "", m > 0 ? `${m}m` : ""].filter(Boolean).join(" ");
}

// GET /api/tasks/:id/relations
router.get("/", async (req, res) => {
  const taskId = Number(req.params.id);
  if (isNaN(taskId)) { res.status(400).json({ error: "Invalid task ID" }); return; }

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
  if (!task || task.deleted_at) { res.status(404).json({ error: "Task not found" }); return; }

  const relations = await db
    .select()
    .from(taskRelationsTable)
    .where(eq(taskRelationsTable.task_id, taskId));

  const result = await Promise.all(
    relations.map(async (rel) => {
      const [relatedTask] = await db
        .select()
        .from(tasksTable)
        .where(eq(tasksTable.id, rel.related_task_id));
      return {
        id: rel.id,
        task_id: rel.task_id,
        related_task_id: rel.related_task_id,
        relation_type: rel.relation_type,
        related_task: relatedTask ? formatTask(relatedTask) : null,
        created_at: rel.created_at.toISOString(),
      };
    })
  );

  res.json(result.filter((r) => r.related_task !== null));
});

// POST /api/tasks/:id/relations
router.post("/", async (req, res) => {
  const taskId = Number(req.params.id);
  if (isNaN(taskId)) { res.status(400).json({ error: "Invalid task ID" }); return; }

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
  if (!task || task.deleted_at) { res.status(404).json({ error: "Task not found" }); return; }

  const parsed = CreateTaskRelationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { related_task_id, relation_type } = parsed.data;

  if (related_task_id === taskId) {
    res.status(400).json({ error: "A task cannot be related to itself" });
    return;
  }

  const [relatedTask] = await db.select().from(tasksTable).where(eq(tasksTable.id, related_task_id));
  if (!relatedTask || relatedTask.deleted_at) {
    res.status(404).json({ error: "Related task not found" });
    return;
  }

  const [existing] = await db
    .select()
    .from(taskRelationsTable)
    .where(
      and(
        eq(taskRelationsTable.task_id, taskId),
        eq(taskRelationsTable.related_task_id, related_task_id),
      )
    );

  if (existing) {
    res.status(400).json({ error: "Relation already exists" });
    return;
  }

  const [relation] = await db
    .insert(taskRelationsTable)
    .values({ task_id: taskId, related_task_id, relation_type })
    .returning();

  res.status(201).json({
    id: relation.id,
    task_id: relation.task_id,
    related_task_id: relation.related_task_id,
    relation_type: relation.relation_type,
    related_task: formatTask(relatedTask),
    created_at: relation.created_at.toISOString(),
  });
});

// DELETE /api/tasks/:id/relations/:relationId
router.delete("/:relationId", async (req, res) => {
  const taskId = Number(req.params.id);
  const relationId = Number(req.params.relationId);
  if (isNaN(taskId) || isNaN(relationId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [existing] = await db
    .select()
    .from(taskRelationsTable)
    .where(and(eq(taskRelationsTable.id, relationId), eq(taskRelationsTable.task_id, taskId)));

  if (!existing) { res.status(404).json({ error: "Relation not found" }); return; }

  await db.delete(taskRelationsTable).where(eq(taskRelationsTable.id, relationId));
  res.json({ message: "Relation deleted" });
});

export default router;
