import type { BunFile } from "bun";
import { basename, extname, join } from "node:path";

export interface AframeServer {
  listen(port: number): void | never;
}

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

    // Fetch file on disk
    if (aframe.static?.[path]) {
      const { file, gzFile } = aframe.static[path];
      const customResponse = await options?.onFetch?.(path, file);
      if (customResponse) return customResponse;

      return new Response(gzFile.stream(), {
        headers: {
          "Content-Type": file.type,
          "Content-Encoding": "gzip",
          "Cache-Control": "max-age=31536000",
        },
      });
    }

    // If the path is asking for a file (e.g., it has an extension), return a
    // 404 if it wasn't in the static list
    const ext = extname(basename(path));
    if (ext) {
      return new Response(undefined, { status: 404 });
    }

    // During development, render a fallback HTML page since Vite should handle
    // all these routes before proxying the request to the server.
    if (aframe.command === "serve") {
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
          },
        },
      );
    }

    // Fallback to public/index.html file
    if (aframe.static?.["fallback"]) {
      const { file, gzFile } = aframe.static["fallback"];
      return createGzipResponse(file, gzFile);
    }

    const file = Bun.file(join(aframe.publicDir, "index.html"));
    const gzFile = Bun.file(join(aframe.publicDir, "index.html.gz"));
    return createGzipResponse(file, gzFile);
  };
}

function createGzipResponse(file: BunFile, gzFile: BunFile): Response {
  return new Response(gzFile.stream(), {
    headers: {
      "Content-Type": file.type,
      "Content-Encoding": "gzip",
    },
  });
}
