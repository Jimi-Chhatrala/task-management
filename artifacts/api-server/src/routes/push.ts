import { Router } from "express";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth";
import { vapidPublicKey } from "../lib/pushService";

const router = Router();

const SubscribeBody = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

const UnsubscribeBody = z.object({
  endpoint: z.string().url(),
});

// GET /api/push/vapid-public-key
router.get("/push/vapid-public-key", (_req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

// POST /api/push/subscribe
router.post("/push/subscribe", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parsed = SubscribeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid subscription" });
    return;
  }
  const { endpoint, p256dh, auth } = parsed.data;

  // Upsert: delete old row with same endpoint, insert fresh
  await db
    .delete(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint));

  await db.insert(pushSubscriptionsTable).values({ user_id: userId, endpoint, p256dh, auth });

  res.status(201).json({ ok: true });
});

// POST /api/push/unsubscribe
router.post("/push/unsubscribe", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parsed = UnsubscribeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  await db
    .delete(pushSubscriptionsTable)
    .where(
      and(
        eq(pushSubscriptionsTable.user_id, userId),
        eq(pushSubscriptionsTable.endpoint, parsed.data.endpoint),
      ),
    );
  res.json({ ok: true });
});

// GET /api/push/status — check whether this user has any subscriptions
router.get("/push/status", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const subs = await db
    .select({ id: pushSubscriptionsTable.id })
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.user_id, userId));
  res.json({ subscribed: subs.length > 0 });
});

export default router;
