import cron from "node-cron";
import { db, tasksTable, pushSubscriptionsTable } from "@workspace/db";
import { and, eq, isNotNull, isNull, lte, gte, sql } from "drizzle-orm";
import { sendPush } from "./pushService";
import { sendEmail, reminderEmailHtml, dueTodayEmailHtml } from "./emailService";
import { logger } from "./logger";

async function getUserEmail(_userId: string): Promise<string | null> {
  // Clerk doesn't expose user emails through the DB — email sending requires
  // a RESEND_FROM_EMAIL and the user's address. For now we skip email if we
  // can't resolve it without a Clerk API call per-user (add Clerk BAPI lookup
  // here if needed in the future).
  return null;
}

async function getAppBaseUrl(): Promise<string> {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  return domain ? `https://${domain}` : "http://localhost:3000";
}

async function notifyUser(
  userId: string,
  payload: { title: string; body: string; url: string },
) {
  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.user_id, userId));

  const expired: number[] = [];
  await Promise.all(
    subs.map(async (sub) => {
      const result = await sendPush(sub, payload);
      if (result === "expired") expired.push(sub.id);
    }),
  );

  if (expired.length > 0) {
    await db
      .delete(pushSubscriptionsTable)
      .where(
        sql`${pushSubscriptionsTable.id} = ANY(ARRAY[${sql.join(expired.map((id) => sql`${id}`), sql`, `)}]::int[])`,
      );
  }
}

async function checkReminders() {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60_000);

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(
      and(
        isNotNull(tasksTable.reminder_at),
        isNull(tasksTable.deleted_at),
        lte(tasksTable.reminder_at, now),
        gte(tasksTable.reminder_at, oneMinuteAgo),
      ),
    );

  const base = await getAppBaseUrl();

  for (const task of tasks) {
    const url = `${base}/tasks/${task.id}`;
    logger.info({ taskId: task.id }, "Sending reminder notification");
    await notifyUser(task.user_id, {
      title: `⏰ Reminder: ${task.task_number}`,
      body: task.task_title,
      url,
    });

    const email = await getUserEmail(task.user_id);
    if (email) {
      await sendEmail({
        to: email,
        subject: `Reminder: ${task.task_number} — ${task.task_title}`,
        html: reminderEmailHtml(task.task_title, task.task_number, url),
      });
    }
  }
}

async function checkDueToday() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(
      and(
        isNotNull(tasksTable.due_date),
        isNull(tasksTable.deleted_at),
        gte(tasksTable.due_date, todayStart),
        lte(tasksTable.due_date, todayEnd),
      ),
    );

  const base = await getAppBaseUrl();

  for (const task of tasks) {
    const url = `${base}/tasks/${task.id}`;
    logger.info({ taskId: task.id }, "Sending due-today notification");
    await notifyUser(task.user_id, {
      title: `📅 Due today: ${task.task_number}`,
      body: task.task_title,
      url,
    });

    const email = await getUserEmail(task.user_id);
    if (email) {
      await sendEmail({
        to: email,
        subject: `Due today: ${task.task_number} — ${task.task_title}`,
        html: dueTodayEmailHtml(task.task_title, task.task_number, url),
      });
    }
  }
}

export function startScheduler() {
  // Check reminders every minute
  cron.schedule("* * * * *", async () => {
    try {
      await checkReminders();
    } catch (err) {
      logger.error({ err }, "Reminder check failed");
    }
  });

  // Check due-today tasks at 9:00 AM every day
  cron.schedule("0 9 * * *", async () => {
    try {
      await checkDueToday();
    } catch (err) {
      logger.error({ err }, "Due-today check failed");
    }
  });

  logger.info("Notification scheduler started");
}
