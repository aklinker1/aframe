import type { BunFile } from "bun";
import { resolve } from "node:path";

const headers = {
  "Cache-Control": "max-age=31536000",
};

export interface AframeServer {
  listen(port: number): void | never;
}

const publicDir = resolve(import.meta.dir, import.meta.publicDir);

/**
 * Fetches a file from the `public` directory.
 */
export function fetchStatic(options?: {
  /** Override the fetch behavior of a file. */
  onFetch?: (
    path: string,
    file: BunFile,
  ) => Promise<Response | undefined> | Response | undefined;
}): (request: Request) => Promise<Response> {
  return async (request) => {
    const path = new URL(request.url).pathname.replace(/\/+$/, "");

    const paths = [`${publicDir}${path}`, `${publicDir}${path}/index.html`];

    // Only fallback on the root HTML file when building application
    if (import.meta.command === "build") {
      paths.push(`${publicDir}/index.html`);
    }

    for (const path of paths) {
      const isHtml = path.includes(".html");
      const gzFile = Bun.file(path + ".gz");
      const file = Bun.file(path);

      if (await isFile(gzFile)) {
        const customResponse = await options?.onFetch?.(path, file);
        if (customResponse) return customResponse;
        return new Response(gzFile.stream(), {
          headers: {
            ...(isHtml ? {} : headers),
            "content-type": file.type,
            "content-encoding": "gzip",
          },
        });
      }

      if (await isFile(file)) {
        const customResponse = await options?.onFetch?.(path, file);
        if (customResponse) return customResponse;

        return new Response(file.stream(), { headers });
      }
    }

    return new Response(
      `<html>
        <body>
          This is a placeholder for your root <code>index.html</code> file during development.
          <br/>
          In production (or via the app's dev server), this path will fallback on the root <code>index.html</code>.
        </body>
      </html>`,
      {
        headers: {
          "Content-Type": "text/html",
          ...headers,
        },
      },
    );
  };
}

async function isFile(file: BunFile): Promise<boolean> {
  try {
    const stats = await file.stat();
    return stats.isFile();
  } catch {
    return false;
  }
}
