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

const SEND_HOUR_MIN = 9;
const SEND_HOUR_MAX = 20;
const TIMEOUT_MINUTES = 20;

interface ParisNow {
  date: string;
  hour: number;
  minute: number;
  second: number;
}

function parisNow(now: Date): ParisNow {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: parseInt(get("hour"), 10),
    minute: parseInt(get("minute"), 10),
    second: parseInt(get("second"), 10),
  };
}

function hashDate(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function todayTarget(date: string): { hour: number; minute: number } {
  const h = hashDate(date);
  const range = SEND_HOUR_MAX - SEND_HOUR_MIN + 1;
  return {
    hour: SEND_HOUR_MIN + (h % range),
    minute: Math.floor(h / range) % 60,
  };
}

async function handleScheduledCheckIn(env: Env, now: Date): Promise<void> {
  const p = parisNow(now);
  const target = todayTarget(p.date);
  if (p.hour * 60 + p.minute < target.hour * 60 + target.minute) return;

  const nowUnix = Math.floor(now.getTime() / 1000);
  const parisMidnightUnix = nowUnix - (p.hour * 3600 + p.minute * 60 + p.second);
  if (await sentRecently(env.DB, parisMidnightUnix)) return;

  const text = pickGreeting(p.hour);
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
  const expected = env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || !(await constantTimeEquals(provided, expected))) {
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
