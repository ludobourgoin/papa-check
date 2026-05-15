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

## Consulter l'historique et les statistiques

Tous les check-ins (envois + réponses + délai + timeouts) sont stockés en permanence dans la table D1 `check_ins`.

**Web (recommandé)** — un dashboard Astro + Clerk déployé sur Cloudflare Pages, dans le dossier [`dashboard/`](dashboard/) du repo. Setup détaillé dans [dashboard/README.md](dashboard/README.md).

**CLI** :

```bash
# 20 derniers check-ins avec délai, statut, extrait de réponse
npm run logs

# Dashboard : taux de réponse, délais moyens, taux de fausses alertes,
# répartition par jour de la semaine
npm run stats
```

`npm run stats` calcule notamment :
- **Taux de réponse global** : `replied / total_envois`
- **Taux de fausses alertes** : `timeouts où papa a fini par répondre positivement / timeouts envoyés` — c'est la métrique "papa allait bien mais n'a pas répondu dans les 20 min"
- **Délai moyen / min / max** de réponse (en minutes)
- **Répartition par jour de la semaine** : utile pour voir si certains jours ont moins de réponses

Pour des requêtes ad-hoc sur la D1 :

```bash
npx wrangler d1 execute papa-check --remote --command "SELECT * FROM check_ins WHERE reply_was_positive = 0"
```

---

## Architecture

- **`src/index.ts`** — entrée Worker : `fetch` (webhook) + `scheduled` (crons).
- **`src/messages.ts`** — 10 variantes de la question matinale.
- **`src/classifier.ts`** — heuristique regex pour "positif vs ambigu".
- **`src/db.ts`** — helpers D1 (insert / update / query).
- **`src/telegram.ts`** — wrapper `sendMessage`.
- **`src/security.ts`** — comparaison constant-time du secret webhook + validation de payload.

Un seul cron `*/5 * * * *` couvre les deux besoins ; les handlers internes filtrent :

- Le check-in n'envoie que si **heure Paris = 10h** **ET** jour ∈ {Lun, Mer, Ven, Sam} **ET** rien envoyé dans les 12h précédentes.
- Le timeout n'agit que s'il existe un check-in sans réponse de plus de 20 min, et alerte une seule fois.

Le passage été/hiver est géré nativement par `Intl.DateTimeFormat({ timeZone: "Europe/Paris" })` — pas besoin d'ajuster le cron.

## Coût

288 invocations/jour de cron + ~quelques webhooks = très en-dessous des limites gratuites Workers (100k/jour) et D1 (5M lectures/jour).

---

## Sécurité

### Modèle de menace

Trois choses à protéger :
1. **Les secrets** (`TELEGRAM_BOT_TOKEN`, chat IDs, `TELEGRAM_WEBHOOK_SECRET`) — ne doivent jamais arriver sur GitHub.
2. **L'endpoint `/telegram`** — URL publique, accessible par n'importe qui : doit n'accepter que des requêtes signées par Telegram.
3. **La D1** — n'est joignable que par le Worker, mais on doit éviter toute injection SQL.

### Défenses en place

| Couche | Défense | Fichier |
|---|---|---|
| Repo local | `.gitignore` étendu : bloque `.env*`, `.dev.vars`, `*.pem`, `*.key`, etc. | [`.gitignore`](.gitignore) |
| Repo local | Pre-commit hook : bloque les fichiers sensibles + scanne le diff pour patterns de secrets (Telegram, AWS, GitHub, Stripe, OpenAI/Anthropic, clés privées…) | [`.githooks/pre-commit`](.githooks/pre-commit) |
| GitHub | Secret Scanning activé (détection passive des leaks dans l'historique) | côté serveur |
| GitHub | Push Protection activé (bloque les `git push` contenant des secrets connus) | côté serveur |
| GitHub | Dependabot Security Updates activé (PRs auto pour CVE) | côté serveur |
| GitHub | Workflow CI : typecheck + `npm audit` + gitleaks sur chaque push/PR | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |
| GitHub | Dependabot config : MAJ hebdo des deps npm + mensuelle des actions | [`.github/dependabot.yml`](.github/dependabot.yml) |
| Worker (auth) | Vérification du header `X-Telegram-Bot-Api-Secret-Token` en **temps constant** (SHA-256 + XOR) | [`src/security.ts`](src/security.ts) |
| Worker (entrée) | Validation stricte du payload : taille max 64 KB, content-type JSON, structure typée, troncature texte à 3500 chars | [`src/security.ts`](src/security.ts) |
| Worker (entrée) | Filtre `chat.id` : ignore tout message qui ne vient pas du chat de papa | [`src/index.ts`](src/index.ts) |
| Worker (timing) | `Date.now()` côté serveur pour les timestamps de réponse (pas confiance dans `msg.date`) | [`src/index.ts`](src/index.ts) |
| Worker (DB) | 100 % requêtes préparées avec `.bind()` — pas de concat SQL | [`src/db.ts`](src/db.ts) |
| Worker (résilience) | `try/catch` global webhook → retourne 200 même en erreur (évite les retry storms Telegram), erreurs visibles dans `wrangler tail` | [`src/index.ts`](src/index.ts) |
| Worker (résilience) | Cron : `Promise.allSettled` pour qu'un handler en erreur ne bloque pas l'autre | [`src/index.ts`](src/index.ts) |

### Activer le pre-commit hook sur ce clone

Une seule fois après le `git clone` :

```bash
git config core.hooksPath .githooks
```

Le hook bloque le commit si :
- un fichier sensible est staged (`.env`, `.dev.vars`, `*.pem`, `id_rsa`…),
- ou le diff contient un pattern de secret reconnu (token Telegram, AWS, GitHub, Stripe, OpenAI, Anthropic, clé privée…).

Pour un bypass exceptionnel : `git commit --no-verify` (à éviter).

### En cas de compromission

Si un secret a été poussé par erreur (ou tu suspectes une fuite), **traite-le comme cramé** et rotate **tout de suite** :

**1 · Telegram Bot Token** — parle à [@BotFather](https://t.me/BotFather) → `/revoke` → choisis le bot. Un nouveau token est généré ; l'ancien meurt instantanément.

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
# puis re-configure le webhook avec le nouveau token (étape 6 plus haut)
```

**2 · Webhook secret**

```bash
NEW=$(openssl rand -hex 32)
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET <<< "$NEW"
# puis appelle setWebhook avec ce nouveau secret_token (étape 6)
```

**3 · Chat IDs** — pas un secret au sens strict, mais si tu veux changer, crée un nouveau chat et update les bindings.

**4 · Purger l'historique git** — si un vrai secret a atterri dans un commit, il est lisible **à vie** dans l'historique GitHub (sauf purge). Utilise [git-filter-repo](https://github.com/newren/git-filter-repo) pour le supprimer, puis force-push. Mais considère le secret comme cramé de toute façon → rotate.

### Limites connues

- Les patterns du pre-commit hook ne couvrent pas **tous** les types de secrets ; c'est une 1ʳᵉ ligne, pas une preuve. Le push protection GitHub + gitleaks en CI font filet.
- Le hook ne se propage pas via `git clone` (limitation Git) ; il faut faire `git config core.hooksPath .githooks` après chaque clone. La CI gitleaks sert de garde-fou côté serveur.
- Les logs `wrangler tail` peuvent contenir des fragments de messages de papa — ne pas partager publiquement.
