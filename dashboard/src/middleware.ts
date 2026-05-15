// Pass-through middleware pour diagnostiquer le bug [object Object].
// On réintroduira l'auth Clerk après avoir confirmé qu'Astro rend correctement.
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (_context, next) => next());
