import type { BunFile } from "bun";

const headers = {
  "Cache-Control": "max-age=31536000",
};

export interface AframeServer {
  listen(port: number): void | never;
}

/**
 * Fetches a file from the `public` directory.
 */
export async function fetchStatic(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/\/+$/, "");
  if (!path) return fetchRootHtml();

  const exactFile = Bun.file(`${import.meta.publicDir}${path}`);
  if (await isFile(exactFile)) return new Response(exactFile, { headers });

  const htmlFile = Bun.file(`${import.meta.publicDir}${path}/index.html`);
  if (await isFile(htmlFile)) return new Response(exactFile, { headers });

  return fetchRootHtml();
}

function fetchRootHtml() {
  if (import.meta.command === "serve") {
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

  return new Response(Bun.file(`${import.meta.publicDir}/index.html`), {
    headers,
  });
}

async function isFile(file: BunFile): Promise<boolean> {
  try {
    const stats = await file.stat();
    return stats.isFile();
  } catch {
    return false;
  }
}
