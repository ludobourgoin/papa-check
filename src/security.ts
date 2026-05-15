export async function constantTimeEquals(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

const MAX_WEBHOOK_BYTES = 64 * 1024;
const MAX_FORWARDED_TEXT = 3500;

export interface ValidatedMessage {
  chatId: string;
  text: string;
}

export async function readAndValidateUpdate(
  req: Request,
): Promise<ValidatedMessage | null> {
  const len = req.headers.get("content-length");
  if (len && parseInt(len, 10) > MAX_WEBHOOK_BYTES) return null;

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) return null;

  const buf = await req.arrayBuffer();
  if (buf.byteLength > MAX_WEBHOOK_BYTES) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(buf));
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  const message = (parsed as Record<string, unknown>).message;
  if (!isRecord(message)) return null;

  const chat = (message as Record<string, unknown>).chat;
  const text = (message as Record<string, unknown>).text;
  if (!isRecord(chat)) return null;
  if (typeof text !== "string") return null;

  const chatId = (chat as Record<string, unknown>).id;
  if (typeof chatId !== "number" || !Number.isFinite(chatId)) return null;

  const safeText = text.slice(0, MAX_FORWARDED_TEXT);
  return { chatId: String(chatId), text: safeText };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
