import type { AstroGlobal } from "astro";
import { createClerkClient } from "@clerk/backend";
import type { User } from "@clerk/backend";

export interface AuthGate {
  redirectTo: string | null;
  user: User | null;
}

export async function requireAllowedUser(astro: AstroGlobal): Promise<AuthGate> {
  const env = astro.locals.runtime.env;
  const client = createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.PUBLIC_CLERK_PUBLISHABLE_KEY,
  });

  const reqState = await client.authenticateRequest(astro.request, {
    publishableKey: env.PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: env.CLERK_SECRET_KEY,
  });

  if (!reqState.isAuthenticated) {
    return { redirectTo: "/sign-in", user: null };
  }

  const { userId } = reqState.toAuth();
  if (!userId) return { redirectTo: "/sign-in", user: null };

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
}
