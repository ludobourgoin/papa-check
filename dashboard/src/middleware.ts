import { clerkMiddleware, clerkClient, createRouteMatcher } from "@clerk/astro/server";

const isProtected = createRouteMatcher(["/", "/api/(.*)"]);

export const onRequest = clerkMiddleware(async (auth, context) => {
  if (!isProtected(context.request)) return;

  const { userId } = auth();
  if (!userId) return context.redirect("/sign-in");

  const user = await clerkClient(context).users.getUser(userId);
  const email = user.emailAddresses
    .find((e) => e.id === user.primaryEmailAddressId)
    ?.emailAddress?.toLowerCase();

  const allowed = (context.locals.runtime.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!email || !allowed.includes(email)) {
    return context.redirect("/forbidden");
  }
});
