# NEXT STEPS — finir le branchement du bot

État au moment de la pause :
- ✅ Bot Telegram `@papa_check_ludo_bot` créé
- ✅ D1 `papa-check` créée + schéma initialisé
- ✅ Worker déployé sur `https://papa-check.ludo-c97.workers.dev`
- ✅ Secrets configurés : `TELEGRAM_BOT_TOKEN`, `TELEGRAM_MY_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`
- ✅ Webhook Telegram branché sur le Worker
- ❌ **Manquant** : `TELEGRAM_FATHER_CHAT_ID` — papa doit envoyer un message au bot une fois pour qu'on récupère son chat ID

## Pré-requis

Papa dispo (en visio, au téléphone, en personne) pour faire 3 clics sur Telegram.

## Procédure (5 étapes)

### 1 · Charger le token en variable shell temporaire

```bash
cd ~/Documents/papa-check
read -s BOT_TOKEN
```

→ colle le token Telegram (celui que BotFather t'a donné), Entrée. Il n'est pas affiché, pas écrit sur disque, juste dans la mémoire du shell courant.

> **Si tu as `/revoke` le token entretemps** (recommandé après leak ou rotation périodique) : BotFather → `/revoke` → choisis le bot → nouveau token généré. Ré-injecte-le dans wrangler **avant** de continuer :
> ```bash
> printf '%s' "$BOT_TOKEN" | npx wrangler secret put TELEGRAM_BOT_TOKEN
> ```

### 2 · Couper temporairement le webhook

Le webhook envoie les messages au Worker en push. Pour récupérer le chat ID de papa via `getUpdates` (polling), il faut désactiver le webhook le temps de l'opération.

```bash
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook"
# → {"ok":true,"result":true,"description":"Webhook was deleted"}
```

### 3 · Papa envoie un message au bot

Papa doit :
1. Ouvrir le lien depuis son Telegram (mobile ou desktop) : **https://t.me/papa_check_ludo_bot**
2. Cliquer sur **Start** / **Démarrer**
3. Envoyer n'importe quel message (genre `coucou`)

Une fois fait, récupère son chat ID :

```bash
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates" | python3 -m json.tool
```

Dans la sortie, repère le bloc `"from"` qui n'est **pas** toi (Ludovic Bourgoin) — c'est papa. Note la valeur de `chat.id` (un nombre, ex. `123456789`).

### 4 · Sauver son chat ID + remettre un webhook (avec un secret tout neuf)

On en profite pour **rotation préventive** du webhook secret (au cas où l'ancien aurait fuité).

```bash
# Ton variable shell — remplace par la vraie valeur lue à l'étape 3
PAPA_ID="123456789"

# Sauve son chat ID comme secret Cloudflare
printf '%s' "$PAPA_ID" | npx wrangler secret put TELEGRAM_FATHER_CHAT_ID

# Génère un nouveau secret webhook, le pousse à Cloudflare ET à Telegram
NEW_WEBHOOK_SECRET=$(openssl rand -hex 32)
printf '%s' "$NEW_WEBHOOK_SECRET" | npx wrangler secret put TELEGRAM_WEBHOOK_SECRET

curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://papa-check.ludo-c97.workers.dev/telegram\",\"secret_token\":\"${NEW_WEBHOOK_SECRET}\",\"allowed_updates\":[\"message\"]}"
# → {"ok":true,"result":true,"description":"Webhook was set"}

unset NEW_WEBHOOK_SECRET BOT_TOKEN
```

### 5 · Test end-to-end

Envoie un message à papa depuis le bot pour valider :

```bash
read -s BOT_TOKEN     # recharge le token, ou réutilise si tu n'as pas unset
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\":\"${PAPA_ID}\",\"text\":\"Test du bot — réponds 'ça va' s'il te plaît\"}"
```

Résultat attendu si papa répond `ça va` :
- Telegram POST → Worker
- Worker valide le header secret
- Classifier → positif → bot répond `Ok super !` à papa
- Pas de notif vers toi (réponse positive)

Si papa répond `bof` ou `j'ai mal au dos` :
- Tu reçois `📨 Réponse de papa : <son texte>` dans ta convo avec le bot

Si papa ne répond pas dans 20 min :
- Tu reçois `⚠️ Pas de réponse de ton père depuis 20 min. Appelle-le.`

### Surveillance

```bash
# Logs live du Worker (laisse tourner pendant le test)
npx wrangler tail

# Voir l'état en DB
npx wrangler d1 execute papa-check --remote \
  --command "SELECT id, datetime(sent_at,'unixepoch') AS sent, reply_text, reply_was_positive, timeout_alert_sent FROM check_ins ORDER BY id DESC LIMIT 5"
```

## Calendrier

**Prochain envoi auto** : tous les lundis, mercredis, vendredis, samedis à 10h Paris.

Tant que `TELEGRAM_FATHER_CHAT_ID` n'est pas configuré, le cron tournera toutes les 5 min entre 10h et 11h les jours d'envoi, échouera silencieusement à chaque tentative (logs visibles via `wrangler tail`), aucun message envoyé. Pas dangereux, juste inutile.
