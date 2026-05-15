/// <reference path="../.astro/types.d.ts" />
/// <reference types="@cloudflare/workers-types" />
/// <reference types="astro/client" />

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ALLOWED_EMAILS: string;
    PUBLIC_CLERK_PUBLISHABLE_KEY: string;
    CLERK_SECRET_KEY: string;
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  readonly CLERK_SECRET_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
