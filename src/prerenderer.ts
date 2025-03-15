import {} from "node:url";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { Browser } from "puppeteer";
import { createServer } from "./dev-server";
import type { ResolvedConfig } from "./config";

export type PrerenderedRoute = {
  route: string;
  file: string;
};

export async function prerenderPages(
  config: ResolvedConfig,
): Promise<PrerenderedRoute[]> {
  const puppeteer = await import("puppeteer");
  const timeout = config.prerenderer.timeout ?? 30e3;

  const server = await createServer(config);
  await server.listen();

  const results: PrerenderedRoute[] = [];
  let browser: Browser | undefined;

  try {
    browser = await puppeteer.launch({
      headless: true,
      timeout,
    });
    for (const route of config.prerenderedRoutes) {
      const url = new URL(route, `http://localhost:${config.appPort}`);
      const page = await browser.newPage();
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
    await Promise.allSettled([server.close(), browser?.close()]);
  }

  return results;
}
