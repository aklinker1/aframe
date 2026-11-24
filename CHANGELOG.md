# Changelog

## v3.0.0

[compare changes](https://github.com/aklinker1/aframe/compare/v2.0.5...v3.0.0)

### 🩹 Fixes

- Add package description ([`b73a51f`](https://github.com/aklinker1/aframe/commit/b73a51f8b1168e46c6d50104178ff7fbe7f6cb0f))

### 🏡 Chore

- Refactor to be server-first ([#6](https://github.com/aklinker1/aframe/pull/6))
- Fix checks ([`84a442e`](https://github.com/aklinker1/aframe/commit/84a442e2854fc2fa6bd10e8216f710bcc5174a84))

### 🤖 CI

- Add CI ([`5cb6730`](https://github.com/aklinker1/aframe/commit/5cb6730519beb5bc1bad347d3008d944e7806a63))

### ⚠️ Breaking Changes

- Refactor to be server-first

### 🚚 Migrating from v2

Your server is now the entrypoint and owns the public port. `aframe dev`, the `proxyPaths` proxy, and the compiled `server-entry` binary are gone.

1. **Update `server/main.ts`.** Remove the `listen(port)` object and start your own server. Anything it doesn't handle falls through to `fetchApp()` (replaces `fetchStatic`). Don't hardcode a port, aframe sets `PORT` while prerendering.

   ```ts
   import { fetchApp } from "@aklinker1/aframe/server";

   const app = fetchApp();

   Bun.serve({
     fetch(request) {
       if (new URL(request.url).pathname.startsWith("/api")) {
         return Response.json({ status: "UP" });
       }
       return app(request);
     },
   });
   ```

   Move any `onFetch` logic before the `fetchApp` call. `fetchApp` returns the SPA's `index.html` for unmatched paths, so your own routes must return their own 404s first.

2. **Update your scripts:**

   ```json
   {
     "dev": "bun --watch --conditions aframe-dev server/main.ts",
     "build": "NODE_ENV=production aframe build",
     "preview": "NODE_ENV=production bun .output/server/main.ts"
   }
   ```

   `aframe` and `aframe dev` now exit with an error. Without `--conditions aframe-dev`, `fetchApp` serves built files, so `bun test` and other scripts that import your server need a build first.

3. **Clean up `aframe.config.ts`.** Remove `appPort`, `serverPort`, `proxyPaths`, `compile`, and `external`. `hooks.afterServerBuild` no longer receives `serverEntryPath`, `compileOutputPath`, `serverModule`, `appPort`, `serverPort`, or `proxyPaths`. `prerenderedRoutes` must now start with `/` and not contain `?` or `#`.

4. **Remove the `aframe` global and `@aklinker1/aframe/env`.** To keep `import.meta.env` types, reference Vite's directly, like in `app/env.d.ts`:

   ```ts
   /// <reference types="vite/client" />
   ```

5. **Move `@aklinker1/aframe` to `dependencies`.** `server/main.ts` imports it at runtime. `vite` and `puppeteer` stay in `devDependencies`.

6. **Update deployment.** There is no compiled binary anymore. Deploy the whole `.output/` directory (`server/`, `public/`, `prerendered/`, `immutable.json`, `node_modules/`, `package.json`) to a machine with Bun, and run `NODE_ENV=production bun .output/server/main.ts`. Update any Docker `COPY server-entry` lines or systemd units. `.env` isn't copied to `.output`, so provide `process.env` in your deployment.

Other behavior changes:

- Prerendered pages and other non-hashed files are served with `Cache-Control: no-cache` instead of a year-long `max-age`. Only hashed bundle files are `immutable`.
- In dev, requests with a `Host` other than `localhost`, `*.localhost`, `127.0.0.1`, or `[::1]` get a 403 unless it's in Vite's `server.allowedHosts`.
- Vite restarts every time `bun --watch` restarts your server. HMR uses port `24678` (or your Vite `server.hmr` config).

### ❤️ Contributors

- [@aklinker1](https://github.com/aklinker1)
