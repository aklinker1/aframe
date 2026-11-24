import type { BunFile } from "bun";
import { existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { resolveRoot } from "../internal/root";
import type { FetchApp, FetchAppOptions } from "../internal/types";

/**
 * Returns a `fetch` function that serves the built and prerendered files from
 * disk. Use it as the fallthrough for any request your server doesn't handle.
 *
 * Run with `--conditions aframe-dev` to get the Vite dev server instead.
 */
export function fetchApp(
  options?: FetchAppOptions,
): (request: Request) => Promise<Response> {
  const root = resolveRoot(options?.root);
  const publicDir = join(root, "public");
  const prerenderedDir = join(root, "prerendered");

  if (!existsSync(join(publicDir, "index.html"))) {
    throw new Error(
      `aframe: ${join(publicDir, "index.html")} not found. For development run with --conditions aframe-dev (bun --watch --conditions aframe-dev server/main.ts); for production run "aframe build" first.`,
    );
  }

  let immutableFiles: Set<string> | undefined;
  const getImmutableFiles = async (): Promise<Set<string>> => {
    if (immutableFiles) return immutableFiles;
    try {
      const files: unknown = await Bun.file(
        join(root, "immutable.json"),
      ).json();
      if (!Array.isArray(files)) return new Set();
      return (immutableFiles = new Set(
        files.filter((f) => typeof f === "string"),
      ));
    } catch {
      return new Set();
    }
  };

  const serveFile = async (
    request: Request,
    absolutePath: string,
    immutableKey?: string,
  ): Promise<Response> => {
    const file = Bun.file(absolutePath);
    const gzFile = Bun.file(`${absolutePath}.gz`);
    const hasGz = await gzFile.exists();

    const headers = new Headers({
      "Content-Type": file.type,
      "Cache-Control":
        immutableKey != null && (await getImmutableFiles()).has(immutableKey)
          ? "max-age=31536000, immutable"
          : "no-cache",
    });
    let body: BunFile = file;
    if (hasGz) {
      headers.set("Vary", "Accept-Encoding");
      if (acceptsGzip(request.headers.get("accept-encoding"))) {
        headers.set("Content-Encoding", "gzip");
        body = gzFile;
      }
    }

    if (request.method === "HEAD") {
      headers.set("Content-Length", String(body.size));
      return new Response(null, { headers });
    }
    return new Response(body, { headers });
  };

  const notFound = () => new Response("Not found", { status: 404 });

  return async (request) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    let path: string;
    try {
      path = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    if (path.includes("\0") || path.includes("\\")) {
      return new Response("Bad request", { status: 400 });
    }

    const relativePath = path.replace(/^\/+|\/+$/g, "");

    if (relativePath) {
      const file = resolveInside(publicDir, relativePath);
      if (file && (await Bun.file(file).exists())) {
        return serveFile(request, file, relativePath);
      }
    }

    const prerendered = resolveInside(
      prerenderedDir,
      join(relativePath, "index.html"),
    );
    if (prerendered && (await Bun.file(prerendered).exists())) {
      return serveFile(request, prerendered);
    }

    const lastSegment = relativePath.slice(relativePath.lastIndexOf("/") + 1);
    if (lastSegment.includes(".")) return notFound();

    return serveFile(request, join(publicDir, "index.html"));
  };
}

fetchApp satisfies FetchApp;

function resolveInside(dir: string, relativePath: string): string | undefined {
  const base = resolve(dir);
  const resolved = resolve(base, relativePath);
  return resolved.startsWith(base + sep) ? resolved : undefined;
}

function acceptsGzip(header: string | null): boolean {
  if (!header) return false;
  for (const part of header.split(",")) {
    const [name, ...params] = part.split(";");
    if (name.trim().toLowerCase() !== "gzip") continue;
    let q = 1;
    for (const param of params) {
      const match = /^\s*q\s*=\s*(\d*\.?\d*)\s*$/i.exec(param);
      if (match) q = Number(match[1]);
    }
    return q > 0;
  }
  return false;
}
