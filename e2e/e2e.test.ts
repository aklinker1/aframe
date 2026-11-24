import { afterAll, beforeAll, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Subprocess } from "bun";
import pkg from "../package.json";
import { findFreePort } from "../src/lib/net";

const repo = resolve(import.meta.dir, "..");
const servers: Subprocess[] = [];
let project: string;

function write(path: string, content: string) {
  const file = join(project, path);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, content);
}

function run(cmd: string[], env: Record<string, string> = {}) {
  return Bun.spawn({
    cmd,
    cwd: project,
    env: { ...process.env, ...env },
    stdout: "inherit",
    stderr: "inherit",
  });
}

async function serve(cmd: string[], env: Record<string, string> = {}) {
  const port = await findFreePort();
  servers.push(run(cmd, { ...env, PORT: String(port) }));
  const origin = `http://localhost:${port}`;
  for (let i = 0; i < 150; i++) {
    try {
      const res = await fetch(origin);
      if (res.status !== 503) return origin;
    } catch {}
    await Bun.sleep(200);
  }
  throw new Error(`${cmd.join(" ")} never responded`);
}

beforeAll(async () => {
  const tarballDir = mkdtempSync(join(tmpdir(), "aframe-e2e-tarball-"));
  project = mkdtempSync(join(tmpdir(), "aframe-e2e-project-"));

  const pack = Bun.spawnSync({
    cmd: ["bun", "pm", "pack", "--destination", tarballDir, "--quiet"],
    cwd: repo,
    stderr: "inherit",
  });
  const tarball = pack.stdout.toString().trim().split("\n").pop()!.trim();

  write(
    "package.json",
    JSON.stringify({
      type: "module",
      dependencies: { "@aklinker1/aframe": `file:${tarball}` },
      devDependencies: {
        vite: pkg.devDependencies.vite,
        puppeteer: pkg.devDependencies.puppeteer,
      },
    }),
  );
  write(
    "aframe.config.ts",
    `import { defineConfig } from "@aklinker1/aframe";
export default defineConfig({ prerenderedRoutes: ["/", "/two"] });`,
  );
  write(
    "app/index.html",
    `<html><body></body><script type="module" src="./main.ts"></script></html>`,
  );
  write(
    "app/main.ts",
    `import { isPrerendering } from "@aklinker1/aframe/app";
document.body.textContent = "prerendering:" + isPrerendering();`,
  );
  write(
    "server/main.ts",
    `import { fetchApp } from "@aklinker1/aframe/server";
const app = fetchApp();
export default {
  fetch: (request: Request) =>
    new URL(request.url).pathname === "/api" ? Response.json({ ok: true }) : app(request),
};`,
  );

  expect(await run(["bun", "install"]).exited).toBe(0);
}, 300e3);

afterAll(() => {
  servers.forEach((server) => server.kill());
  rmSync(project, { recursive: true, force: true });
});

it("should use the Vite implementation with --conditions aframe-dev", async () => {
  const origin = await serve([
    "bun",
    "--conditions",
    "aframe-dev",
    "server/main.ts",
  ]);
  expect(await (await fetch(origin)).text()).toContain("/@vite/client");
  expect(await (await fetch(`${origin}/api`)).json()).toEqual({ ok: true });
  const evil = await fetch(origin, { headers: { host: "evil.example.com" } });
  expect(evil.status).toBe(403);
}, 60e3);

it("should build, prerender, and serve with the prod implementation", async () => {
  const env = { NODE_ENV: "production" };
  expect(await run(["bun", "run", "aframe", "build"], env).exited).toBe(0);

  const origin = await serve(["bun", ".output/server/main.ts"], env);
  expect(await (await fetch(`${origin}/two`)).text()).toContain(
    "prerendering:true",
  );
  expect(await (await fetch(`${origin}/api`)).json()).toEqual({ ok: true });
}, 180e3);
