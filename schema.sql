CREATE TABLE IF NOT EXISTS check_ins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sent_at INTEGER NOT NULL,
  message_text TEXT NOT NULL,
  reply_received_at INTEGER,
  reply_text TEXT,
  reply_was_positive INTEGER,
  timeout_alert_sent INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_check_ins_open
  ON check_ins(reply_received_at, sent_at DESC);
