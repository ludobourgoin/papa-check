#!/usr/bin/env bash
set -euo pipefail

DB_FLAG="${1:---remote}"
LIMIT="${2:-20}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

npx wrangler d1 execute papa-check "$DB_FLAG" --json --command "
SELECT
  id,
  datetime(sent_at, 'unixepoch')                          AS envoye_le,
  substr(message_text, 1, 30)                             AS message,
  CASE
    WHEN reply_received_at IS NULL THEN NULL
    ELSE (reply_received_at - sent_at) / 60
  END                                                     AS delai_min,
  CASE
    WHEN reply_received_at IS NULL AND timeout_alert_sent = 1 THEN 'TIMEOUT'
    WHEN reply_received_at IS NULL                       THEN 'en attente'
    WHEN reply_was_positive = 1                          THEN 'positif'
    ELSE                                                      'transféré'
  END                                                     AS statut,
  substr(reply_text, 1, 40)                               AS reponse
FROM check_ins
ORDER BY sent_at DESC
LIMIT $LIMIT;
" 2>/dev/null | python3 "$SCRIPT_DIR/format_table.py"
