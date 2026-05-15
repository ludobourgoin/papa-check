import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import clerk from "@clerk/astro";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [clerk()],
  vite: {
    ssr: {
      external: ["node:crypto", "node:buffer", "node:async_hooks"],
    },
  },
});
