import {} from "node:url";
import { dirname, join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { Browser } from "puppeteer";
import type { ResolvedConfig } from "./config";

export type PrerenderedRoute = {
  route: string;
  absolutePath: string;
  relativePath: string;
};

export async function prerenderPages(
  config: ResolvedConfig,
): Promise<PrerenderedRoute[]> {
  if (config.prerenderer === false) return [];

  const puppeteer = await import("puppeteer");
  const {
    timeout = 30e3,
    launch,
    waitForSelector,
    waitForSelectorVisible,
    waitForTimeout,
  } = config.prerenderer ?? {};

  const server = Bun.spawn({
    cmd: ["bun", join(config.serverOutDir, "server-entry.js")],
    cwd: config.rootDir,
    stdio: ["inherit", "inherit", "inherit"],
  });

  const results: PrerenderedRoute[] = [];
  let browser: Browser | undefined;

  try {
    let args = launch?.args ?? [];
    // Workaround for Linux SUID Sandbox issues.
    if (process.platform === "linux" && !args.includes("--no-sandbox")) {
      args.push("--no-sandbox", "--disable-setuid-sandbox");
    }

    browser = await puppeteer.launch({
      headless: true,
      timeout,
      ...launch,
      args,
    });
    for (const route of config.prerenderedRoutes) {
      const url = new URL(route, `http://localhost:${config.appPort}`);
      const page = await browser.newPage();
      page.evaluateOnNewDocument(`globalThis.__AFRAME_PRERENDERING = true`);
      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(timeout);
      await page.goto(url.href);
      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, {
          visible: waitForSelectorVisible,
        });
      } else if (waitForTimeout != null) {
        await new Promise((res) => setTimeout(res, waitForTimeout));
      }

      const html = await page.content();
      await page.close();

      if (html.includes("<vite-error-overlay>")) {
        throw Error("Vite error prevented page from being rendered.");
      }

      const relativePath = join(route.substring(1), "index.html");
      const absolutePath = join(config.prerenderedDir, relativePath);
      const dir = dirname(absolutePath);
      await mkdir(dir, { recursive: true });
      await writeFile(absolutePath, html);
      results.push({
        route,
        relativePath,
        absolutePath,
      });
    }
  } finally {
    server.kill("SIGINT");
    await browser?.close();
  }

  return results;
}
