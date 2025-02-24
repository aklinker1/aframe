import type { BunFile } from "bun";

const headers = {
  "Cache-Control": "max-age=31536000",
};

export interface AframeServer {
  listen(port: number): void | never;
}

const cache: Record<string, BunFile> = {};

/**
 * Fetches a file from the `public` directory.
 */
export async function fetchStatic(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  if (cache[path]) return new Response(cache[path], { headers });

  const paths = [
    `${import.meta.publicDir}${path}.gz`,
    `${import.meta.publicDir}${path}`,
    `${import.meta.publicDir}${path}/index.html.gz`,
    `${import.meta.publicDir}${path}/index.html`,
  ];

  // Only fallback on the root HTML file when building application
  if (import.meta.command === "build") {
    paths.push(
      `${import.meta.publicDir}/index.html.gz`,
      `${import.meta.publicDir}/index.html`,
    );
  }

  for (const path of paths) {
    const file = Bun.file(path);
    if (await isFile(file)) {
      cache[path] = file;
      return new Response(file, { headers });
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
}

async function isFile(file: BunFile): Promise<boolean> {
  try {
    const stats = await file.stat();
    return stats.isFile();
  } catch {
    return false;
  }
}
