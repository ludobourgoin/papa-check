import type { AstroGlobal } from "astro";
import { env } from "cloudflare:workers";
import { createClerkClient } from "@clerk/backend";
import type { User } from "@clerk/backend";

export interface AuthGate {
  redirectTo: string | null;
  user: User | null;
  debugError?: string;
}

export async function requireAllowedUser(astro: AstroGlobal): Promise<AuthGate> {
  try {
    const secretKey = env.CLERK_SECRET_KEY;
    const publishableKey = env.PUBLIC_CLERK_PUBLISHABLE_KEY;

    if (!secretKey || !publishableKey) {
      console.error("auth: missing Clerk env vars");
      return { redirectTo: "/forbidden", user: null, debugError: "missing-env" };
    }

    const client = createClerkClient({ secretKey, publishableKey });
    const reqState = await client.authenticateRequest(astro.request, {
      publishableKey,
      secretKey,
    });

    if (!reqState.isAuthenticated) {
      return { redirectTo: "/sign-in", user: null };
    }

    const userId = reqState.toAuth()?.userId;
    if (!userId) {
      return { redirectTo: "/sign-in", user: null };
    }

    const user = await client.users.getUser(userId);
    const email = user.emailAddresses
      .find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress?.toLowerCase();

    const allowed = (env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (!email || !allowed.includes(email)) {
      return { redirectTo: "/forbidden", user: null };
    }

    return { redirectTo: null, user };
  } catch (err) {
    console.error("auth: requireAllowedUser threw", err);
    const msg = err instanceof Error ? err.message : String(err);
    return { redirectTo: null, user: null, debugError: msg };
  }
}
