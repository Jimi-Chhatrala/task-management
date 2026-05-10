import webpush from "web-push";
import { logger } from "./logger";

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY ?? "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? "";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:notifications@taskapp.dev",
    vapidPublicKey,
    vapidPrivateKey,
  );
}

export { vapidPublicKey };

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export interface PushSub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendPush(sub: PushSub, payload: PushPayload): Promise<"ok" | "expired"> {
  if (!vapidPublicKey || !vapidPrivateKey) return "ok";
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return "ok";
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) return "expired";
    logger.error({ err }, "Push send failed");
    return "ok";
  }
}
