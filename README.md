# aframe

Simple wrapper around Vite for creating pre-rendered, client-side web apps with a backend.

## Project Structure

<!-- prettier-ignore -->
```html
📂 {rootDir}/
   📁 app/
      📄 index.html
      📄 main.ts
   📁 public/
      📄 favicon.ico
   📁 server/
      📄 main.ts
   📄 .env
   📄 aframe.config.ts
```

```ts
// aframe.config.ts
import { defineConfig } from "@aklinker1/aframe";

export default defineConfig({
  // See https://vite.dev/config/
  vite: {
    // ...
  },
  // List of routes to pre-render.
  prerenderedRoutes: ["/"],
  // Configure how prerendering works, or set to `false` to disable
  prerender: {
    // ...
  },
});
```

```ts
// server/main.ts
import { fetchApp } from "@aklinker1/aframe/server";

const app = fetchApp();

// Your server owns the public port. Handle your own routes, and pass everything
// else to `fetchApp`.
Bun.serve({
  fetch(request) {
    if (new URL(request.url).pathname.startsWith("/api")) {
      return Response.json({ status: "UP" });
    }
    return app(request);
  },
});
```

`server/main.ts` is the required name of the production entry. `fetchApp` finds the project root as the parent of the entry file's directory. Pass `fetchApp({ root })` to override it.

```html
<!-- app/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hello Aframe</title>
  </head>
  <body></body>
  <script type="module" src="./main.ts"></script>
</html>
```

```sh
bun add @aklinker1/aframe
bun add -D puppeteer vite
```

```jsonc
// package.json
{
  "name": "my-app",
  "version": "1.0.0",
  "packageManager": "bun@1.3.5",
  "scripts": {
    "dev": "bun --watch --conditions aframe-dev server/main.ts",
    "build": "NODE_ENV=production aframe build",
    "preview": "NODE_ENV=production bun .output/server/main.ts",
  },
  "dependencies": {
    "@aklinker1/aframe": "latest",
  },
  "devDependencies": {
    "vite": "latest",
    "puppeteer": "latest",
  },
}
```

`@aklinker1/aframe` must be a `dependency` (not a `devDependency`), because `server/main.ts` imports it at runtime.

To get types for `import.meta.env` in your app, reference Vite's client types directly, for example in `app/env.d.ts`:

```ts
/// <reference types="vite/client" />
```

## Usage

### How it works

Your server is the entrypoint and owns the public port. Anything it doesn't handle itself falls through to `fetchApp()`:

- **In dev**, run with `--conditions aframe-dev`. `fetchApp()` starts Vite on a private port and proxies requests to it. The browser connects to Vite's HMR websocket directly on port `24678` (or `server.hmr` from your Vite config).
- **In production**, `fetchApp()` serves the built files from `.output/public` and the prerendered pages from `.output/prerendered`, with gzip and caching.

The `--conditions aframe-dev` flag is a [package export condition](https://nodejs.org/api/packages.html#conditional-exports). It's what keeps Vite out of your production code. Without it, you get the production implementation, so anything that runs your server without the flag (`bun test`, IDE debuggers, one-off scripts) will throw `public/index.html not found` unless you've built the app.

Keep these in mind:

- **Don't hardcode a port.** aframe sets `PORT` (and `BUN_PORT`) while prerendering, and a hardcoded port, like `Bun.serve({ port: 3000 })` or `.listen(3000)`, breaks it. Read `PORT` instead, or leave the port unset if your server does.
- **Return your own 404s.** `fetchApp` falls back to the SPA's `index.html` (with a 200) for unmatched paths without a file extension, so an unknown `GET /api/x` that reaches it returns HTML.
- **Dev only serves `localhost`.** Requests with another `Host` get a 403 unless it is in Vite's `server.allowedHosts`. Optionally set `hostname: "localhost"` in your server's options to also bind only the loopback interface.
- **`HTTP_PROXY`**: Bun's `fetch` honors it, even for loopback. If you're behind a proxy, set `NO_PROXY=127.0.0.1` before starting the process.
- Vite is cold-started every time `bun --watch` restarts your server. The page reloads itself when it reconnects.

### Elysia

```ts
// server/main.ts
import { Elysia } from "elysia";
import { fetchApp } from "@aklinker1/aframe/server";

const app = fetchApp();

new Elysia()
  .get("/api/user/:id", ({ params }) => params.id)
  .all("*", ({ request }) => app(request))
  .listen(Number(process.env.PORT) || 3000);
```

### Hono

```ts
// server/main.ts
import { Hono } from "hono";
import { fetchApp } from "@aklinker1/aframe/server";

const app = fetchApp();

export default new Hono()
  .get("/api/user/:id", (c) => c.text(c.req.param("id")))
  .all("*", (c) => app(c.req.raw));
```

### Deployment

`aframe build` outputs a normal Bun app to `.output/`. To run it you need the Bun runtime and the whole `.output/` directory (`server/`, `public/`, `prerendered/`, `immutable.json`, `node_modules/`, `package.json`):

```sh
NODE_ENV=production bun .output/server/main.ts
```

Set `NODE_ENV=production`, otherwise Bun runs in development mode and autoloads `.env.development`. `PORT` sets the port.

### Environment

Create a single `.env` file in your project root. `app` secrets must be prefixed with `APP_`, whereas `server` secrets don't need any prefix:

```sh
# {rootDir}/.env
APP_DEFAULT_MODEL=gemini-2.0-flash
OPENAI_API_KEY=...
```

In this case, you could use `import.meta.env.APP_DEFAULT_MODEL` in your `app` code and `process.env.OPENAI_API_KEY` in your server code.

Bun loads `.env` from the working directory, so run `bun` from the project root in dev. The `.env` file is **not** copied to `.output`, so your deployment environment has to provide `process.env`. `APP_*` values are compiled into the client bundle at build time.

### Import files as text

When importing a file as text, like an HTML template or a `.gql` schema, you should use `with { type: "text"
 }`:

```ts
// server/main.ts
import welcomeEmailTemplate from "./assets/email-templates/welcome.html" with { type: "text" };
```

## Detecting Prerender

Aframe provides a helper for checking if the app is being prerendered, `isPrerendering()`:

```vue
<!-- ClientOnly.vue -->
<script setup lang="ts">
import { isPrerendering } from "@aklinker1/aframe/app";

const visible = !isPrerendering();
</script>

<template>
  <slot v-if="visible" />
  <slot v-else name="fallback" />
</template>
```

## Publish Update to NPM

```sh
bun run release patch
```
