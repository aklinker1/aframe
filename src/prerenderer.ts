import {} from "node:url";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { Browser } from "puppeteer";
import type { ResolvedConfig } from "./config";

export type PrerenderedRoute = {
  route: string;
  file: string;
};

export async function prerenderPages(
  config: ResolvedConfig,
): Promise<PrerenderedRoute[]> {
  if (config.prerenderer === false) return [];

  const puppeteer = await import("puppeteer");
  const timeout = config.prerenderer.timeout ?? 30e3;

  const server = Bun.spawn({
    cmd: ["bun", "--env-file", "../.env", "server-entry.js"],
    cwd: config.serverOutDir,
    stdio: ["inherit", "inherit", "inherit"],
  });

  const results: PrerenderedRoute[] = [];
  let browser: Browser | undefined;

  try {
    let args = config.prerenderer.launch?.args ?? [];
    // Workaround for Linux SUID Sandbox issues.
    if (process.platform === "linux" && !args.includes("--no-sandbox")) {
      args.push("--no-sandbox", "--disable-setuid-sandbox");
    }

    browser = await puppeteer.launch({
      headless: true,
      timeout,
      ...config.prerenderer.launch,
      args,
    });
    for (const route of config.prerenderedRoutes) {
      const url = new URL(route, `http://localhost:${config.appPort}`);
      const page = await browser.newPage();
      page.evaluateOnNewDocument(`globalThis.__AFRAME_PRERENDERING = true`);
      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(timeout);
      await page.goto(url.href);
      if (config.prerenderer.waitForSelector) {
        await page.waitForSelector(config.prerenderer.waitForSelector, {
          visible: config.prerenderer.waitForSelectorVisible,
        });
      } else if (config.prerenderer.waitForTimeout != null) {
        await new Promise((res) =>
          setTimeout(res, config.prerenderer.waitForTimeout),
        );
      }

      const html = await page.content();
      await page.close();

      if (html.includes("<vite-error-overlay>")) {
        throw Error("Vite error prevented page from being rendered.");
      }

      const dir = join(config.appOutDir, route.substring(1));
      const file = join(dir, "index.html");
      await mkdir(dir, { recursive: true });
      await writeFile(file, html);
      results.push({
        file,
        route,
      });
    }
  } finally {
    server.kill("SIGINT");
    await browser?.close();
  }

  return results;
}
