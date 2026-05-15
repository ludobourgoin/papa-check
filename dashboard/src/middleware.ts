import type { MiddlewareHandler } from "astro";

export const onRequest: MiddlewareHandler = async (_context, next) => {
  const response = await next();
  return response;
};
