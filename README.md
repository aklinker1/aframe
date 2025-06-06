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
      📄 env.d.ts
      📄 main.ts
   📄 .env
   📄 aframe.config.ts
```

```ts
// aframe.config.ts
export default defineConfig({
  // See https://vite.dev/config/
  vite: {
    // ...
  },
  // List of routes to pre-render.
  prerenderedRoutes: ["/"],
  // See https://github.com/Tofandel/prerenderer?tab=readme-ov-file#prerenderer-options
  prerenderer: {
    // ...
  },
});
```

```ts
// server/env.d.ts
/// <reference types="@aklinker1/aframe/env" />
```

```ts
// server/main.ts
import { Elysia } from "elysia";

// You don't have to use `elysia`, the default export just needs to have a
// `listen(port)` function.
const app = new Elysia()
  .get("/", "Hello Elysia")
  .get("/user/:id", ({ params }) => params.id)
  .post("/form", ({ body }) => body);

export default app;
```

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
bun add elysia @aklinker1/aframe
bun add -D puppeteer vite
```

```jsonc
// package.json
{
  "name": "my-app",
  "version": "1.0.0",
  "packageManager": "bun@1.2.2",
  "scripts": {
    "aframe": "bun node_modules/@aklinker1/aframe/bin/aframe.ts",
    "dev": "bun --silent aframe",
    "build": "bun --silent aframe build",
    "preview": "bun .output/server-entry.js",
  },
  "dependencies": {
    "@aklinker1/aframe": "latest",
    "elysia": "latest",
  },
  "devDependencies": {
    "vite": "latest",
    "puppeteer": "latest",
  },
}
```

## Usage

### Environment

Create a single `.env` file in your project root. `app` secrets must be prefixed with `APP_`, whereas `server` secrets don't need any prefix:

```sh
# {rootDir}/.env
APP_DEFAULT_MODEL=gemini-2.0-flash
OPENAI_API_KEY=...
```

In this case, you could use `import.meta.env.VITE_DEFAULT_MODEL` in your `app` code and `process.env.OPENAI_API_KEY` in your server code.

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
