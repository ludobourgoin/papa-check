import { clerkMiddleware, createRouteMatcher } from "@clerk/astro/server";

const isProtected = createRouteMatcher([
  "/",
  "/api/(.*)",
]);

export const onRequest = clerkMiddleware((auth, context) => {
  if (isProtected(context.request) && !auth().userId) {
    return context.redirect("/sign-in");
  }
});
