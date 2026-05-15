import { sendMessage } from "./telegram";
import { pickGreeting } from "./messages";
import { isPositive } from "./classifier";
import {
  getOpenCheckIn,
  insertCheckIn,
  markTimeoutAlertSent,
  recordReply,
  sentRecently,
} from "./db";
import { constantTimeEquals, readAndValidateUpdate } from "./security";

export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_FATHER_CHAT_ID: string;
  TELEGRAM_MY_CHAT_ID: string;
  TELEGRAM_WEBHOOK_SECRET: string;
}

const SEND_WEEKDAYS = new Set([1, 3, 5, 6]);
const SEND_HOUR_PARIS = 10;
const TIMEOUT_MINUTES = 20;

interface ParisTime {
  hour: number;
  weekday: number;
}

function parisTime(now: Date): ParisTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    hour: parseInt(get("hour"), 10),
    weekday: weekdayMap[get("weekday")] ?? -1,
  };
}

async function handleScheduledCheckIn(env: Env, now: Date): Promise<void> {
  const { hour, weekday } = parisTime(now);
  if (!SEND_WEEKDAYS.has(weekday)) return;
  if (hour !== SEND_HOUR_PARIS) return;

  const nowUnix = Math.floor(now.getTime() / 1000);
  if (await sentRecently(env.DB, nowUnix - 12 * 3600)) return;

  const text = pickGreeting();
  await sendMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_FATHER_CHAT_ID, text);
  await insertCheckIn(env.DB, nowUnix, text);
}

async function handleTimeoutCheck(env: Env, now: Date): Promise<void> {
  const open = await getOpenCheckIn(env.DB);
  if (!open || open.timeout_alert_sent === 1) return;

  const nowUnix = Math.floor(now.getTime() / 1000);
  if (nowUnix - open.sent_at < TIMEOUT_MINUTES * 60) return;

  await sendMessage(
    env.TELEGRAM_BOT_TOKEN,
    env.TELEGRAM_MY_CHAT_ID,
    `⚠️ Pas de réponse de ton père depuis ${TIMEOUT_MINUTES} min. Appelle-le.`,
  );
  await markTimeoutAlertSent(env.DB, open.id);
}

async function handleWebhook(req: Request, env: Env): Promise<Response> {
  const ok = new Response("ok");

  const provided = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!(await constantTimeEquals(provided, env.TELEGRAM_WEBHOOK_SECRET))) {
    return new Response("forbidden", { status: 403 });
  }

  const validated = await readAndValidateUpdate(req);
  if (!validated) return ok;

  if (validated.chatId !== env.TELEGRAM_FATHER_CHAT_ID) return ok;

  const nowUnix = Math.floor(Date.now() / 1000);
  const open = await getOpenCheckIn(env.DB);

  if (!open) {
    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      env.TELEGRAM_MY_CHAT_ID,
      `💬 Message spontané de papa :\n\n${validated.text}`,
    );
    return ok;
  }

  const positive = isPositive(validated.text);
  await recordReply(env.DB, open.id, nowUnix, validated.text, positive);

  if (positive) {
    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      env.TELEGRAM_FATHER_CHAT_ID,
      "Ok super !",
    );
  } else {
    await sendMessage(
      env.TELEGRAM_BOT_TOKEN,
      env.TELEGRAM_MY_CHAT_ID,
      `📨 Réponse de papa :\n\n${validated.text}`,
    );
  }

  return ok;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method !== "POST" || url.pathname !== "/telegram") {
      return new Response("not found", { status: 404 });
    }
    try {
      return await handleWebhook(req, env);
    } catch (err) {
      console.error("webhook error", err);
      return new Response("ok");
    }
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const now = new Date(controller.scheduledTime);
    ctx.waitUntil(
      Promise.allSettled([
        handleScheduledCheckIn(env, now),
        handleTimeoutCheck(env, now),
      ]).then((results) => {
        for (const r of results) {
          if (r.status === "rejected") console.error("scheduled error", r.reason);
        }
      }),
    );
  },
};
