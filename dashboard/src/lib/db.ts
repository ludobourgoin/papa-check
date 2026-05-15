export interface CheckInRow {
  id: number;
  sent_at: number;
  message_text: string;
  reply_received_at: number | null;
  reply_text: string | null;
  reply_was_positive: number | null;
  timeout_alert_sent: number;
}

export interface Stats {
  total: number;
  replied: number;
  responseRatePct: number | null;
  positive: number;
  ambiguous: number;
  noReply: number;
  delayAvgMin: number | null;
  delayMinMin: number | null;
  delayMaxMin: number | null;
  timeoutsAlerted: number;
  falseAlarms: number;
  falseAlarmRatePct: number | null;
}

export async function getStats(db: D1Database): Promise<Stats> {
  const row = await db
    .prepare(
      `SELECT
        COUNT(*)                                                                                                                                                AS total,
        SUM(CASE WHEN reply_received_at IS NOT NULL THEN 1 ELSE 0 END)                                                                                          AS replied,
        SUM(CASE WHEN reply_was_positive = 1 THEN 1 ELSE 0 END)                                                                                                 AS positive,
        SUM(CASE WHEN reply_received_at IS NOT NULL AND reply_was_positive = 0 THEN 1 ELSE 0 END)                                                               AS ambiguous,
        SUM(CASE WHEN reply_received_at IS NULL THEN 1 ELSE 0 END)                                                                                              AS noReply,
        AVG(CASE WHEN reply_received_at IS NOT NULL THEN (reply_received_at - sent_at) / 60.0 END)                                                              AS delayAvgMin,
        MIN(CASE WHEN reply_received_at IS NOT NULL THEN (reply_received_at - sent_at) / 60.0 END)                                                              AS delayMinMin,
        MAX(CASE WHEN reply_received_at IS NOT NULL THEN (reply_received_at - sent_at) / 60.0 END)                                                              AS delayMaxMin,
        SUM(CASE WHEN timeout_alert_sent = 1 THEN 1 ELSE 0 END)                                                                                                 AS timeoutsAlerted,
        SUM(CASE WHEN timeout_alert_sent = 1 AND reply_received_at IS NOT NULL AND reply_was_positive = 1 THEN 1 ELSE 0 END)                                    AS falseAlarms
      FROM check_ins`,
    )
    .first<{
      total: number;
      replied: number | null;
      positive: number | null;
      ambiguous: number | null;
      noReply: number | null;
      delayAvgMin: number | null;
      delayMinMin: number | null;
      delayMaxMin: number | null;
      timeoutsAlerted: number | null;
      falseAlarms: number | null;
    }>();

  const total = row?.total ?? 0;
  const replied = row?.replied ?? 0;
  const positive = row?.positive ?? 0;
  const ambiguous = row?.ambiguous ?? 0;
  const noReply = row?.noReply ?? 0;
  const timeoutsAlerted = row?.timeoutsAlerted ?? 0;
  const falseAlarms = row?.falseAlarms ?? 0;

  return {
    total,
    replied,
    responseRatePct: total > 0 ? Math.round((replied / total) * 1000) / 10 : null,
    positive,
    ambiguous,
    noReply,
    delayAvgMin: row?.delayAvgMin ?? null,
    delayMinMin: row?.delayMinMin ?? null,
    delayMaxMin: row?.delayMaxMin ?? null,
    timeoutsAlerted,
    falseAlarms,
    falseAlarmRatePct:
      timeoutsAlerted > 0
        ? Math.round((falseAlarms / timeoutsAlerted) * 1000) / 10
        : null,
  };
}

export async function getRecentCheckIns(
  db: D1Database,
  limit: number = 50,
): Promise<CheckInRow[]> {
  const result = await db
    .prepare(
      `SELECT id, sent_at, message_text, reply_received_at, reply_text,
              reply_was_positive, timeout_alert_sent
       FROM check_ins
       ORDER BY sent_at DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<CheckInRow>();
  return result.results ?? [];
}

export function statusLabel(row: CheckInRow): {
  label: string;
  className: string;
} {
  if (row.reply_received_at === null) {
    if (row.timeout_alert_sent === 1) {
      return { label: "Timeout", className: "status-timeout" };
    }
    return { label: "En attente", className: "status-pending" };
  }
  if (row.reply_was_positive === 1) {
    return { label: "Positif", className: "status-positive" };
  }
  return { label: "Transféré", className: "status-forwarded" };
}

export function delayMinutes(row: CheckInRow): number | null {
  if (row.reply_received_at === null) return null;
  return Math.round((row.reply_received_at - row.sent_at) / 60);
}

export function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
