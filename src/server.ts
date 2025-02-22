import type { BunFile } from "bun";

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
  if (await isFile(exactFile)) return new Response(exactFile);

  const htmlFile = Bun.file(`${import.meta.publicDir}${path}/index.html`);
  if (await isFile(htmlFile)) return new Response(exactFile);

  return fetchRootHtml();
}

function fetchRootHtml() {
  if (import.meta.command === "serve") {
    return Response.json(
      { status: 404, error: "Root index.html not served during development" },
      { status: 404 },
    );
  }

  return new Response(Bun.file(`${import.meta.publicDir}/index.html`));
}

async function isFile(file: BunFile): Promise<boolean> {
  try {
    return (await file.stat()).isFile();
  } catch {
    return false;
  }
}
