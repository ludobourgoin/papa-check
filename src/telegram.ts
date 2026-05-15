const TG_BASE = "https://api.telegram.org/bot";

export async function sendMessage(
  token: string,
  chatId: string,
  text: string,
): Promise<void> {
  const res = await fetch(`${TG_BASE}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    throw new Error(`Telegram sendMessage failed: HTTP ${res.status}`);
  }
}
