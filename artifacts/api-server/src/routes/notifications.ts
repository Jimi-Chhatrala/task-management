import { Router } from "express";
import { db, taskNotificationsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

function formatNotification(n: typeof taskNotificationsTable.$inferSelect) {
  return {
    ...n,
    created_at: n.created_at.toISOString(),
  };
}

// GET /api/notifications
router.get("/notifications", async (req, res) => {
  const unreadOnly = req.query.unread_only === "true";

  let query = db
    .select()
    .from(taskNotificationsTable)
    .orderBy(desc(taskNotificationsTable.created_at))
    .$dynamic();

  if (unreadOnly) {
    query = query.where(eq(taskNotificationsTable.read, false));
  }

  const notifications = await query;
  res.json(notifications.map(formatNotification));
});

// GET /api/notifications/unread-count
router.get("/notifications/unread-count", async (req, res) => {
  const unread = await db
    .select()
    .from(taskNotificationsTable)
    .where(eq(taskNotificationsTable.read, false));

  res.json({ count: unread.length });
});

// POST /api/notifications/read-all
router.post("/notifications/read-all", async (req, res) => {
  await db
    .update(taskNotificationsTable)
    .set({ read: true })
    .where(eq(taskNotificationsTable.read, false));

  res.json({ message: "All notifications marked as read" });
});

// PATCH /api/notifications/:id/read
router.patch("/notifications/:id/read", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid notification ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(taskNotificationsTable)
    .where(eq(taskNotificationsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  const [updated] = await db
    .update(taskNotificationsTable)
    .set({ read: true })
    .where(eq(taskNotificationsTable.id, id))
    .returning();

  res.json(formatNotification(updated));
});

export default router;
