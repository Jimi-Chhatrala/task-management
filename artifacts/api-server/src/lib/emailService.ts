import { logger } from "./logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Task Tracker <notifications@resend.dev>";

export function isEmailEnabled(): boolean {
  return !!RESEND_API_KEY;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!RESEND_API_KEY) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: opts.to, subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.warn({ status: res.status, body }, "Resend email failed");
    }
  } catch (err) {
    logger.error({ err }, "Email send error");
  }
}

export function reminderEmailHtml(taskTitle: string, taskNumber: string, taskUrl: string): string {
  return `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:8px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#111">⏰ Reminder: ${taskNumber}</h2>
      <p style="margin:0 0 24px;font-size:15px;color:#444">${taskTitle}</p>
      <a href="${taskUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">View Task</a>
      <p style="margin:32px 0 0;font-size:12px;color:#999">You're receiving this because you set a reminder on this task.</p>
    </div>`;
}

export function dueTodayEmailHtml(taskTitle: string, taskNumber: string, taskUrl: string): string {
  return `
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:8px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#111">📅 Due today: ${taskNumber}</h2>
      <p style="margin:0 0 24px;font-size:15px;color:#444">${taskTitle}</p>
      <a href="${taskUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">View Task</a>
      <p style="margin:32px 0 0;font-size:12px;color:#999">You're receiving this because this task is due today.</p>
    </div>`;
}
