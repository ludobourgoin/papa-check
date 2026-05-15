# papa-check

Bot Telegram qui vérifie la santé de papa via Cloudflare Worker + D1.

- **Cron** : envoi tous les lundis, mercredis, vendredis et samedis à **10h Paris**.
- **Classification** : mots-clés (positif → "Ok super !", sinon → transfert à toi).
- **Timeout** : si pas de réponse à T+20min → notif urgente à toi.

---

## 1 · Créer le bot Telegram

1. Sur Telegram, parle à [@BotFather](https://t.me/BotFather) → `/newbot`.
2. Récupère le **token** (`123456:ABC-...`).
3. Désactive la confidentialité de groupe si besoin : `/setprivacy` → Disable (pas obligatoire pour des chats privés).

## 2 · Récupérer les chat IDs

1. Parle à ton bot depuis le compte Telegram de **papa** (n'importe quel message).
2. Fais pareil depuis **ton compte**.
3. Ouvre dans un navigateur :

   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```

4. Note les deux `chat.id` numériques.

## 3 · Cloudflare : D1 + Worker

```bash
npm install

# Crée la base D1
npx wrangler d1 create papa-check
# → copie le database_id renvoyé dans wrangler.toml

# Initialise le schéma (remote = prod)
npm run db:init

# Pour le dev local
npm run db:init:local
```

## 4 · Secrets

Génère d'abord un secret webhook au hasard (32+ chars) :

```bash
openssl rand -hex 32
```

Puis configure tous les secrets :

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_FATHER_CHAT_ID
npx wrangler secret put TELEGRAM_MY_CHAT_ID
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

## 5 · Deploy

```bash
npm run deploy
```

Note l'URL renvoyée (ex : `https://papa-check.<sous-domaine>.workers.dev`).

## 6 · Configurer le webhook Telegram

```bash
WORKER_URL="https://papa-check.<sous-domaine>.workers.dev"
BOT_TOKEN="<TON_BOT_TOKEN>"
SECRET="<TON_TELEGRAM_WEBHOOK_SECRET>"

curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WORKER_URL}/telegram\", \"secret_token\": \"${SECRET}\"}"
```

Vérifie :

```bash
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

## 7 · Tester

- Forcer un envoi manuel :

  ```bash
  curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d "{\"chat_id\": \"<FATHER_CHAT_ID>\", \"text\": \"Salut papa, ça va ?\"}"
  ```

- Suivre les logs en live :

  ```bash
  npm run tail
  ```

- Voir les check-ins en DB :

  ```bash
  npm run db:query -- "SELECT id, datetime(sent_at,'unixepoch') AS sent, reply_text, reply_was_positive, timeout_alert_sent FROM check_ins ORDER BY id DESC LIMIT 10"
  ```

---

## Architecture

- **`src/index.ts`** — entrée Worker : `fetch` (webhook) + `scheduled` (crons).
- **`src/messages.ts`** — 10 variantes de la question matinale.
- **`src/classifier.ts`** — heuristique regex pour "positif vs ambigu".
- **`src/db.ts`** — helpers D1 (insert / update / query).
- **`src/telegram.ts`** — wrapper `sendMessage` + types.

Un seul cron `*/5 * * * *` couvre les deux besoins ; les handlers internes filtrent :

- Le check-in n'envoie que si **heure Paris = 10h** **ET** jour ∈ {Lun, Mer, Ven, Sam} **ET** rien envoyé dans les 12h précédentes.
- Le timeout n'agit que s'il existe un check-in sans réponse de plus de 20 min, et alerte une seule fois.

Le passage été/hiver est géré nativement par `Intl.DateTimeFormat({ timeZone: "Europe/Paris" })` — pas besoin d'ajuster le cron.

## Coût

288 invocations/jour de cron + ~quelques webhooks = très en-dessous des limites gratuites Workers (100k/jour) et D1 (5M lectures/jour).
