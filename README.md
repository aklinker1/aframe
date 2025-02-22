# aframe

Simple wrapper around Vite for creating pre-rendered, client-side web apps with a backend.

## Project Structure

<!-- prettier-ignore -->
```html
📂 {rootDir}/
   📁 app/
      📄 .env
      📄 index.html
      📄 main.ts
   📁 public/
      📄 favicon.ico
   📁 server/
      📄 .env
      📄 main.ts
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

```json
// package.json
{
  "name": "my-app",
  "version": "1.0.0",
  "packageManager": "bun@1.2.2",
  "scripts": {
    "dev": "aframe",
    "build": "aframe build",
    "preview": "bun --cwd .output server-entry.js"
  },
  "dependencies": {
    "@aklinker1/aframe": "@latest",
    "@prerenderer/prerenderer": "@latest",
    "@prerenderer/renderer-puppeteer": "@latest"
    "elysia": "@latest"
    "vite": "@latest",
  }
}
```
