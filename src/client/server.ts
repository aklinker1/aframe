import type { BunFile } from "bun";
import { readFileSync } from "node:fs";
import { join, extname, basename } from "node:path";

const cacheHeaders = {
  "Cache-Control": "max-age=31536000",
};

export interface AframeServer {
  listen(port: number): void | never;
}

const staticPathsFile = join(import.meta.dir, "static.json");
const publicDir = join(import.meta.dir, "public");

let staticPaths: Record<string, { cacheable: boolean; path: string }> = {};
try {
  staticPaths = JSON.parse(readFileSync(staticPathsFile, "utf-8"));
} catch {}
console.log(staticPaths);

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
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    console.log({ path, route: staticPaths[path] });

    // Fetch file on disk
    if (staticPaths[path]) {
      const filePath = join(import.meta.dir, staticPaths[path].path);
      const file = Bun.file(filePath);

      const customResponse = await options?.onFetch?.(path, file);
      if (customResponse) return customResponse;

      return new Response(file, {
        headers: staticPaths[path].cacheable ? cacheHeaders : {},
      });
    }

    const ext = extname(basename(path));
    if (ext) {
      return new Response(undefined, { status: 404 });
    }

    // Fallback to public/index.html file
    return new Response(
      import.meta.command === "build"
        ? Bun.file(join(publicDir, "index.html"))
        : `<html>
  <body>
    This is a placeholder for your root <code>index.html</code> file during development.
    <br/>
    In production (or via the app's dev server), this path will fallback on the root <code>index.html</code>.
  </body>
</html>`,
      {
        headers: {
          "Content-Type": "text/html",
        },
      },
    );
  };
}
