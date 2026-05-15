export interface CheckIn {
  id: number;
  sent_at: number;
  message_text: string;
  reply_received_at: number | null;
  reply_text: string | null;
  reply_was_positive: number | null;
  timeout_alert_sent: number;
}

export async function getOpenCheckIn(db: D1Database): Promise<CheckIn | null> {
  return await db
    .prepare(
      "SELECT * FROM check_ins WHERE reply_received_at IS NULL ORDER BY sent_at DESC LIMIT 1",
    )
    .first<CheckIn>();
}

export async function insertCheckIn(
  db: D1Database,
  sentAt: number,
  messageText: string,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO check_ins (sent_at, message_text, timeout_alert_sent) VALUES (?, ?, 0)",
    )
    .bind(sentAt, messageText)
    .run();
}

export async function recordReply(
  db: D1Database,
  id: number,
  replyAt: number,
  replyText: string,
  positive: boolean,
): Promise<void> {
  await db
    .prepare(
      "UPDATE check_ins SET reply_received_at = ?, reply_text = ?, reply_was_positive = ? WHERE id = ?",
    )
    .bind(replyAt, replyText, positive ? 1 : 0, id)
    .run();
}

export async function markTimeoutAlertSent(
  db: D1Database,
  id: number,
): Promise<void> {
  await db
    .prepare("UPDATE check_ins SET timeout_alert_sent = 1 WHERE id = ?")
    .bind(id)
    .run();
}

export async function sentRecently(
  db: D1Database,
  sinceUnix: number,
): Promise<boolean> {
  const result = await db
    .prepare("SELECT COUNT(*) as c FROM check_ins WHERE sent_at > ?")
    .bind(sinceUnix)
    .first<{ c: number }>();
  return (result?.c ?? 0) > 0;
}
