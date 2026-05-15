# papa-check dashboard

Tableau de bord web Astro + Clerk déployé sur Cloudflare Pages, lit la même D1 que le Worker `papa-check`.

- Auth : Clerk (sign-up/sign-in, allowlist côté Clerk pour limiter les inscriptions à toi + papa)
- Données : D1 `papa-check` partagée avec le Worker
- Refresh : auto toutes les 60 sec + bouton manuel

## Setup en 4 étapes (à faire une seule fois)

### 1 · Créer une app Clerk

1. Va sur https://dashboard.clerk.com → **Add application**
2. Nom : `papa-check`
3. Choisis les options de connexion (email/password suffit, ou ajoute Google si tu veux)
4. Une fois créée, va sur **API Keys**. Tu y verras :
   - `Publishable key` : `pk_test_...` (publique, ira dans `PUBLIC_CLERK_PUBLISHABLE_KEY`)
   - `Secret key` : `sk_test_...` (privée, ira dans `CLERK_SECRET_KEY`)

### 2 · Configurer l'allowlist Clerk (pour limiter les inscriptions à toi + papa)

Dans le dashboard Clerk :

1. **User & Authentication** → **Restrictions**
2. Active **Allowlist mode** : "Sign-ups are only allowed for users on the allowlist"
3. Ajoute :
   - Ton email (ludo@coolbeans.cc)
   - Celui de papa

Toute personne hors allowlist qui essaiera de créer un compte sera bloquée par Clerk avec un message d'erreur clair.

### 3 · Créer le projet Cloudflare Pages

Option A — via le dashboard Cloudflare (recommandé) :

1. Sur https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Sélectionne le repo `ludobourgoin/papa-check`
3. **Project name** : `papa-check-dashboard`
4. **Production branch** : `main`
5. **Build settings** :
   - Framework preset : **Astro**
   - **Root directory** : `dashboard`
   - Build command : `npm run build`
   - Build output directory : `dist`
6. Section **Environment variables** :
   - `PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_test_...` (valeur de Clerk)
   - `CLERK_SECRET_KEY` = `sk_test_...` (marque comme **encrypted**)
7. **Save and Deploy**

Le premier build prend ~2 min. Tu obtiens une URL `https://papa-check-dashboard.pages.dev`.

### 4 · Lier la D1 au projet Pages

Une fois le projet créé, va dans **Settings** → **Functions** → **D1 database bindings** → **Add binding** :

- Variable name : `DB`
- D1 database : `papa-check` (la base existante)

Redéploie (Settings → Deployments → Re-deploy) pour que le binding prenne effet.

### 5 · Tester

1. Ouvre `https://papa-check-dashboard.pages.dev`
2. Le middleware Clerk te redirige vers `/sign-in`
3. Crée ton compte avec un email de l'allowlist
4. Tu arrives sur le dashboard

Pour papa : envoie-lui le lien `https://papa-check-dashboard.pages.dev/sign-up`. Il crée son compte avec son email (qui doit être dans l'allowlist Clerk).

## Dev local

```bash
cd dashboard
cp .env.example .env
# remplis .env avec tes clés Clerk de test
npm run dev
```

Le dev local n'a pas accès à la D1 distante par défaut. Pour tester avec la prod D1 en local, utilise `wrangler pages dev` après un build :

```bash
npm run build
wrangler pages dev ./dist --d1 DB=cd14815d-001a-4765-986e-4952c2be09b2
```

## Architecture

- **`src/middleware.ts`** — protège `/` et `/api/*` derrière Clerk. Redirige vers `/sign-in` si non authentifié.
- **`src/pages/index.astro`** — page principale, SSR sur Pages, lit la D1 via `Astro.locals.runtime.env.DB`.
- **`src/pages/sign-in.astro` / `sign-up.astro`** — pages d'auth utilisant les composants Clerk.
- **`src/lib/db.ts`** — helpers SQL (stats agrégés + check-ins récents) avec prepared statements.
- **`src/layouts/Layout.astro`** — HTML shell + thème light/dark via `prefers-color-scheme`.

## Sécurité

- Clerk gère le sign-in/sign-out + cookies de session HttpOnly Secure SameSite.
- Allowlist côté Clerk : seuls les emails listés peuvent créer un compte.
- Pas de secret en clair dans le code : `CLERK_SECRET_KEY` est dans les env vars chiffrées Cloudflare.
- D1 accès via prepared statements (`.bind()`) — pas de concat SQL.
- Le middleware s'exécute sur **toutes** les requêtes vers `/` et `/api/*` (pas de bypass).
