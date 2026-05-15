#!/usr/bin/env bash
set -euo pipefail

DB_FLAG="${1:---remote}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

query() {
  local sql="$1"
  npx wrangler d1 execute papa-check "$DB_FLAG" --json --command "$sql" 2>/dev/null \
    | python3 "$SCRIPT_DIR/format_table.py"
}

echo
echo "═══════ Statistiques globales ═══════"
query "
SELECT
  COUNT(*)                                                            AS total_envois,
  SUM(CASE WHEN reply_received_at IS NOT NULL THEN 1 ELSE 0 END)      AS replied,
  ROUND(100.0 * SUM(CASE WHEN reply_received_at IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS taux_reponse_pct,
  SUM(CASE WHEN reply_was_positive = 1 THEN 1 ELSE 0 END)             AS positifs,
  SUM(CASE WHEN reply_received_at IS NOT NULL AND reply_was_positive = 0 THEN 1 ELSE 0 END) AS negatifs_ambigus,
  SUM(CASE WHEN reply_received_at IS NULL THEN 1 ELSE 0 END)          AS sans_reponse
FROM check_ins;
"

echo
echo "═══════ Délais de réponse (en minutes) ═══════"
query "
SELECT
  ROUND(AVG((reply_received_at - sent_at) / 60.0), 1) AS delai_moyen_min,
  ROUND(MIN((reply_received_at - sent_at) / 60.0), 1) AS delai_min_min,
  ROUND(MAX((reply_received_at - sent_at) / 60.0), 1) AS delai_max_min
FROM check_ins
WHERE reply_received_at IS NOT NULL;
"

echo
echo "═══════ Taux de fausses alertes ═══════"
echo "(timeout > 20 min mais papa était finalement OK)"
query "
SELECT
  SUM(CASE WHEN timeout_alert_sent = 1 THEN 1 ELSE 0 END)                                                                          AS alertes_envoyees,
  SUM(CASE WHEN timeout_alert_sent = 1 AND reply_received_at IS NOT NULL AND reply_was_positive = 1 THEN 1 ELSE 0 END)             AS fausses_alertes,
  CASE
    WHEN SUM(CASE WHEN timeout_alert_sent = 1 THEN 1 ELSE 0 END) = 0 THEN NULL
    ELSE ROUND(100.0 * SUM(CASE WHEN timeout_alert_sent = 1 AND reply_received_at IS NOT NULL AND reply_was_positive = 1 THEN 1 ELSE 0 END)
                     / SUM(CASE WHEN timeout_alert_sent = 1 THEN 1 ELSE 0 END), 1)
  END AS taux_fausses_alertes_pct
FROM check_ins;
"

echo
echo "═══════ Répartition par jour de la semaine ═══════"
query "
SELECT
  CASE strftime('%w', sent_at, 'unixepoch')
    WHEN '0' THEN 'dimanche'
    WHEN '1' THEN 'lundi'
    WHEN '2' THEN 'mardi'
    WHEN '3' THEN 'mercredi'
    WHEN '4' THEN 'jeudi'
    WHEN '5' THEN 'vendredi'
    WHEN '6' THEN 'samedi'
  END                                                                                                  AS jour,
  COUNT(*)                                                                                             AS envois,
  ROUND(100.0 * SUM(CASE WHEN reply_was_positive = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1)      AS pct_positif,
  ROUND(AVG(CASE WHEN reply_received_at IS NOT NULL THEN (reply_received_at - sent_at) / 60.0 END), 1) AS delai_moyen_min
FROM check_ins
GROUP BY strftime('%w', sent_at, 'unixepoch')
ORDER BY strftime('%w', sent_at, 'unixepoch');
"
echo
