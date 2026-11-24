import { createServer, type ViteDevServer } from "vite";
import { resolveConfig } from "../config";
import {
  cleanRequestHeaders,
  cleanResponseHeaders,
  isHostAllowed,
} from "../internal/http";
import { findFreePort, isPortFree } from "../internal/net";
import { resolveRoot } from "../internal/root";
import type { FetchApp, FetchAppOptions } from "../internal/types";

const DEFAULT_HMR_PORT = 24678;

type DevState = {
  server: ViteDevServer;
  port: number;
  allowedHosts: true | string[] | undefined;
};

/**
 * Starts Vite on a private port and returns a `fetch` function that proxies
 * requests to it.
 */
export function fetchApp(
  options?: FetchAppOptions,
): (request: Request) => Promise<Response> {
  const root = resolveRoot(options?.root);

  const state: Promise<DevState | undefined> = startVite(root).catch((err) => {
    console.error("aframe: failed to start the dev server:", err);
    return undefined;
  });

  return async (request) => {
    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      return text("Bad request", 400);
    }

    const dev = await state;
    if (!dev) {
      return text(
        "aframe: the dev server failed to start. Check the terminal for details.",
        503,
      );
    }

    const host = request.headers.get("host") ?? url.host;
    if (!isHostAllowed(host, dev.allowedHosts)) {
      return text(`aframe: host "${host}" is not allowed.`, 403);
    }

    const upstream = `http://127.0.0.1:${dev.port}${url.pathname}${url.search}`;
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    try {
      const response = await fetch(upstream, {
        method: request.method,
        headers: cleanRequestHeaders(request.headers),
        body: hasBody ? request.body : undefined,
        redirect: "manual",
        signal: request.signal,
      });
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: cleanResponseHeaders(response.headers),
      });
    } catch (err) {
      if (request.signal.aborted) return new Response(null, { status: 499 });
      console.error("aframe: failed to proxy request to Vite:", err);
      return text(
        "aframe: bad gateway, the Vite dev server didn't respond.",
        502,
      );
    }
  };
}

fetchApp satisfies FetchApp;

async function startVite(root: string): Promise<DevState> {
  const config = await resolveConfig(root, "serve", "development");
  const viteConfig = config.vite;
  const userHmr = viteConfig.server?.hmr;
  const allowedHosts = viteConfig.server?.allowedHosts;

  const port = await findFreePort();
  viteConfig.server ??= {};
  viteConfig.server.proxy = undefined;
  viteConfig.server.host = "127.0.0.1";
  viteConfig.server.port = port;
  viteConfig.server.strictPort = true;
  viteConfig.clearScreen = false;

  if (userHmr === undefined) {
    let hmrPort = DEFAULT_HMR_PORT;
    if (!(await isPortFree(hmrPort))) {
      hmrPort = await findFreePort();
      console.warn(
        `aframe: port ${DEFAULT_HMR_PORT} is in use, using ${hmrPort} for HMR. Refresh the page manually after the server restarts.`,
      );
    }
    viteConfig.server.hmr = { port: hmrPort };
  }

  const server = await createServer(viteConfig);
  await server.listen();
  return { server, port, allowedHosts };
}

function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
