import { afterAll, beforeAll, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { fetchApp } from "../server";

let root: string;
let app: (request: Request) => Promise<Response>;

function write(path: string, content: string, gzip = false) {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  if (gzip) writeFileSync(`${file}.gz`, gzipSync(content));
}

const get = (path: string, init?: RequestInit) =>
  app(new Request(`http://localhost${path}`, init));

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "aframe-server-test-"));
  write("public/index.html", "spa");
  write("public/assets/app.js", "js", true);
  write("public/logo.png", "png");
  write("prerendered/two/index.html", "two");
  write("prerendered/docs/v1.2/index.html", "docs");
  write("secret.txt", "secret");
  write("immutable.json", JSON.stringify(["assets/app.js"]));
  app = fetchApp({ root });
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

it("should throw when public/index.html is missing", () => {
  expect(() => fetchApp({ root: tmpdir() })).toThrow("--conditions aframe-dev");
});

it("should look up prerendered routes before the extension check, then fall back", async () => {
  expect(await (await get("/two/")).text()).toBe("two");
  expect(await (await get("/docs/v1.2")).text()).toBe("docs");
  expect(await (await get("/unknown")).text()).toBe("spa");
  expect((await get("/missing.js")).status).toBe(404);
});

it("should negotiate gzip using the uncompressed content type", async () => {
  const gzip = await get("/assets/app.js", {
    headers: { "accept-encoding": "br, gzip;q=0.5" },
  });
  expect(gzip.headers.get("content-encoding")).toBe("gzip");
  expect(gzip.headers.get("content-type")).toContain("javascript");
  for (const value of ["gzip;q=0", "x-gzip"]) {
    const res = await get("/assets/app.js", {
      headers: { "accept-encoding": value },
    });
    expect(res.headers.get("content-encoding")).toBeNull();
    expect(await res.text()).toBe("js");
  }
});

it("should only cache files in immutable.json forever", async () => {
  expect((await get("/assets/app.js")).headers.get("cache-control")).toBe(
    "max-age=31536000, immutable",
  );
  expect((await get("/logo.png")).headers.get("cache-control")).toBe(
    "no-cache",
  );
});

it("should reject unsupported methods", async () => {
  const res = await get("/", { method: "POST" });
  expect(res.status).toBe(405);
  expect(res.headers.get("allow")).toBe("GET, HEAD");
});

it("should not serve files outside the output directory", async () => {
  for (const path of [
    "/../secret.txt",
    "/%2e%2e/secret.txt",
    "/..%2fsecret.txt",
    "/..%5csecret.txt",
    "/assets/%2e%2e/%2e%2e/secret.txt",
    "/logo.png%00",
  ]) {
    const res = await get(path);
    expect(res.status === 200 ? await res.text() : res.status).toBeOneOf([
      "spa",
      400,
      404,
    ]);
  }
});
