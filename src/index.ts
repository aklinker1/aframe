import type { BunPlugin } from "bun";
import { createReadStream, createWriteStream, lstatSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path/posix";
import * as vite from "vite";
import { BLUE, BOLD, CYAN, DIM, GREEN, MAGENTA, RESET } from "./color";
import type { ResolvedConfig } from "./config";
import { createTimer } from "./timer";
import { prerenderPages, type PrerenderedRoute } from "./prerenderer";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";

export * from "./config";
export * from "./dev-server";

export async function build(config: ResolvedConfig) {
  const buildTimer = createTimer();

  // Clear outDir
  await rm(config.outDir, { force: true, recursive: true });
  await mkdir(config.outDir, { recursive: true });

  const appTimer = createTimer();
  console.log(
    `${BOLD}${CYAN}ℹ${RESET} Building ${CYAN}./app${RESET} with ${GREEN}Vite ${vite.version}${RESET}`,
  );
  const appOutput = (await vite.build(config.vite)) as vite.Rollup.RollupOutput;
  console.log(`${GREEN}✔${RESET} Built in ${appTimer()}`);

  const allAbsoluteAppFiles = (
    await readdir(config.appOutDir, { recursive: true, withFileTypes: true })
  )
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
  const allAppFiles = allAbsoluteAppFiles.map((path) =>
    relative(config.appOutDir, path),
  );

  const bundledAppFiles = appOutput.output.map((entry) => entry.fileName);
  const bundledAppFileSet = new Set(bundledAppFiles);
  const publicAppFiles = allAppFiles.filter(
    (file) => !bundledAppFileSet.has(file),
  );

  await gzipFiles(config, allAbsoluteAppFiles);

  const staticRoutesFile = join(config.serverOutDir, "static.json");
  let staticRoutes = [
    ...Array.from(bundledAppFiles)
      .filter((path) => path !== "index.html")
      .map((path) => [`/${path}`, { cacheable: true, path: `public/${path}` }]),
    ...publicAppFiles
      .filter((path) => path !== "index.html")
      .map((path) => [
        `/${path}`,
        { cacheable: false, path: `public/${path}` },
      ]),
  ];
  await writeFile(
    staticRoutesFile,
    JSON.stringify(Object.fromEntries(staticRoutes)),
  );

  console.log();

  const serverTimer = createTimer();
  console.log(
    `${BOLD}${CYAN}ℹ${RESET} Building ${CYAN}./server${RESET} with ${MAGENTA}Bun ${Bun.version}${RESET}`,
  );
  await Bun.build({
    outdir: config.serverOutDir,
    sourcemap: "external",
    entrypoints: [config.serverEntry],
    target: "bun",
    define: {
      "import.meta.command": `"build"`,
    },
    plugins: [aframeServerMainBunPlugin(config)],
    throw: true,
  });
  console.log(`${GREEN}✔${RESET} Built in ${serverTimer()}`);

  console.log();

  let prerendered: PrerenderedRoute[] = [];
  if (config.prerenderer !== false) {
    const prerenderTimer = createTimer();
    console.log(
      `${BOLD}${CYAN}ℹ${RESET} Prerendering...\n` +
        config.prerenderedRoutes
          .map((route) => `  ${DIM}-${RESET} ${CYAN}${route}${RESET}`)
          .join("\n"),
    );
    prerendered = await prerenderPages(config);
    console.log(`${GREEN}✔${RESET} Prerendered in ${prerenderTimer()}`);
  } else {
    console.log(`${DIM}${BOLD}→${RESET} Pre-rendering disabled`);
  }

  await gzipFiles(
    config,
    prerendered.map((entry) => entry.absolutePath),
  );

  staticRoutes = staticRoutes.concat(
    prerendered.map((entry) => [
      entry.route,
      { cacheable: false, path: `prerendered/${entry.relativePath}` },
    ]),
  );
  await writeFile(
    staticRoutesFile,
    JSON.stringify(Object.fromEntries(staticRoutes)),
  );

  console.log();

  console.log(`${GREEN}✔${RESET} Application built in ${buildTimer()}`);
  const relativeOutDir = `${relative(config.rootDir, config.outDir)}/`;
  const files = (
    await readdir(config.outDir, { recursive: true, withFileTypes: true })
  )
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .toSorted()
    .map((file): [file: string, size: number] => [
      relative(config.outDir, file),
      lstatSync(file).size,
    ]);
  const fileColumnCount = files.reduce(
    (max, [file]) => Math.max(file.length, max),
    0,
  );
  const totalSize = files.reduce((sum, [_, bytes]) => sum + bytes, 0);
  console.log(
    files
      .map(([file, size], i, array) => {
        const boxChar = i === array.length - 1 ? "└" : "├";
        return `   ${DIM}${boxChar}─ ${relativeOutDir}${RESET}${getColor(file)}${file.padEnd(fileColumnCount)}${RESET}  ${DIM}${prettyBytes(size)}${RESET}`;
      })
      .join("\n"),
  );
  console.log(`${CYAN}Σ Total size:${RESET} ${prettyBytes(totalSize)}`);
  console.log();
}

function aframeServerMainBunPlugin(config: ResolvedConfig): BunPlugin {
  return {
    name: "aframe:resolve-server-main",
    setup(bun) {
      bun.onResolve({ filter: /^aframe:server-main$/ }, () => ({
        path: config.serverModule,
      }));
    },
  };
}

function getColor(file: string) {
  if (file.endsWith(".js")) return CYAN;
  if (file.endsWith(".html")) return GREEN;
  if (file.endsWith(".css")) return MAGENTA;
  if (file.endsWith(".map")) return DIM;
  if (file.endsWith(".gz")) return DIM;
  return BLUE;
}

function prettyBytes(bytes: number) {
  const units = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const base = 1024;
  if (bytes === 0) return "0 B";
  const exponent = Math.floor(Math.log(bytes) / Math.log(base));
  const unit = units[exponent];
  const value = bytes / Math.pow(base, exponent);
  return `${unit === "B" ? value : value.toFixed(2)} ${unit}`;
}

async function gzipFiles(
  config: ResolvedConfig,
  files: string[],
): Promise<void> {
  for (const file of files) await gzipFile(config, file);
}

async function gzipFile(config: ResolvedConfig, file: string): Promise<void> {
  await writeFile(`${file}.gz`, "");
  await pipeline(
    createReadStream(file),
    createGzip(),
    createWriteStream(`${file}.gz`),
  );
}
