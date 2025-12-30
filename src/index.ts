import {
  createReadStream,
  createWriteStream,
  lstatSync,
  type CopyOptions,
} from "node:fs";
import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path/posix";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import * as vite from "vite";
import { BLUE, BOLD, CYAN, DIM, GREEN, MAGENTA, RESET, YELLOW } from "./color";
import type { ResolvedConfig } from "./config";
import { prerenderPages, type PrerenderedRoute } from "./prerender";
import { createTimer } from "./timer";

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

  await gzipFiles(allAbsoluteAppFiles);

  const staticRoutes: StaticRouteArray = [
    ...Array.from(bundledAppFiles)
      .filter((path) => path !== "index.html")
      .map((path) => ({
        route: `/${path}`,
        cacheable: true,
        filePath: `public/${path}`,
        gzPath: `public/${path}.gz`,
      })),
    ...publicAppFiles
      .filter((path) => path !== "index.html")
      .flatMap((path) => ({
        route: `/${path}`,
        cacheable: false,
        filePath: `public/${path}`,
        gzPath: `public/${path}.gz`,
      })),
  ];

  console.log();

  const serverTimer = createTimer();
  console.log(`${BOLD}${CYAN}ℹ${RESET} Preparing ${CYAN}./server${RESET}`);
  await buildServer(config, staticRoutes);
  console.log(`${GREEN}✔${RESET} Done in ${serverTimer()}`);

  console.log();

  let prerendered: PrerenderedRoute[] = [];
  if (config.prerender !== false) {
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
    console.log(`${DIM}${BOLD}→${RESET} Pre-render disabled`);
  }

  await gzipFiles(prerendered.map((entry) => entry.absolutePath));

  staticRoutes.push({
    route: "fallback",
    cacheable: false,
    filePath: "public/index.html",
    gzPath: "public/index.html.gz",
  });
  for (const entry of prerendered) {
    staticRoutes.push({
      route: entry.route,
      cacheable: false,
      filePath: `prerendered/${entry.relativePath}`,
      gzPath: `prerendered/${entry.relativePath}.gz`,
    });
  }
  await writeServerEntry(config, staticRoutes);

  console.log();

  console.log(`${GREEN}✔${RESET} Bundled in ${buildTimer()}`);
  const relativeOutDir = `${relative(config.rootDir, config.outDir)}/`;
  const files = (
    await listDirFiles(config.outDir, (path) => !path.includes("node_modules"))
  )
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
        return `  ${DIM}${boxChar}─ ${relativeOutDir}${RESET}${getColor(file)}${file.padEnd(fileColumnCount)}${RESET}  ${DIM}${prettyBytes(size)}${RESET}`;
      })
      .join("\n"),
  );
  console.log(`${CYAN}Σ Total size:${RESET} ${prettyBytes(totalSize)}`);
  console.log();

  if (config.compile) {
    const compileTimer = createTimer();
    console.log(`${BOLD}${CYAN}ℹ${RESET} Compiling single binary`);

    await writeServerEntry(config, staticRoutes);
    await Bun.build({
      compile: {
        outfile: config.compileOutputPath,
      },
      entrypoints: [config.serverEntryPath],
    });
    console.log(`${GREEN}✔${RESET} Compiled in ${compileTimer()}`);
    console.log(
      `  ${DIM}└─${RESET} ${BLUE}${relative(process.cwd(), config.compileOutputPath)}${RESET}  ${DIM}${prettyBytes(lstatSync(config.compileOutputPath).size)}${RESET}`,
    );
    console.log();

    console.log(
      `To preview production build, run:

   ${GREEN}./${relative(process.cwd(), config.compileOutputPath)}${RESET}
`,
    );
  } else {
    console.log(
      `To preview production build, run:

   ${GREEN}bun run ${relative(process.cwd(), config.serverEntryPath)}${RESET}
`,
    );
  }
}

async function buildServer(
  config: ResolvedConfig,
  staticRoutes: StaticRouteArray,
): Promise<void> {
  const cpDirOptions: CopyOptions = {
    recursive: true,
    filter: (src) =>
      !src.includes("__tests__") &&
      !src.includes(".test.") &&
      !src.includes(".spec."),
  };

  await Promise.all([
    // Copy dirs
    ...["server", "shared"].map((src) =>
      cp(
        join(config.rootDir, src),
        join(config.outDir, src),
        cpDirOptions,
      ).catch(() => {
        // Ignore errors
      }),
    ),
    // Copy root files
    ...["bun.lock", "bun.lockb", "tsconfig.json", ".npmrc"].map((file) =>
      cp(join(config.rootDir, file), join(config.outDir, file)).catch(() => {
        // Ignore errors
      }),
    ),
  ]);

  const packageJson = await Bun.file(config.packageJsonPath)
    .json()
    .catch(() => ({}));
  await writeFile(
    join(config.outDir, "package.json"),
    JSON.stringify(
      {
        version: packageJson.version,
        dependencies: packageJson.dependencies,
        devDependencies: packageJson.devDependencies,
      },
      null,
      2,
    ),
  );

  await writeServerEntry(config, staticRoutes);

  const installProc = Bun.spawn(
    ["bun", "i", "--production", "--frozen-lockfile"],
    {
      cwd: config.outDir,
    },
  );
  const installStatus = await installProc.exited;
  if (installStatus !== 0) {
    throw new Error(`Failed to run "bun i --production" in ${config.outDir}`);
  }

  await config.hooks?.afterServerBuild?.(config);
}

async function writeServerEntry(
  config: ResolvedConfig,
  staticRoutes: StaticRouteArray,
): Promise<void> {
  const staticDef: string[] = [];
  if (staticRoutes.length > 0) {
    staticDef.push("  static: {");
    staticRoutes.forEach((entry, i) => {
      staticDef.push(
        `  "${entry.route}": { file: Bun.file(file${i}), cacheable: ${entry.cacheable}, gzFile: Bun.file(gzFile${i}) },`,
      );
    });
    staticDef.push("  },");
  }

  await writeFile(
    join(config.outDir, "server-entry.ts"),
    `import { resolve } from 'node:path';
${staticRoutes
  .flatMap(({ filePath }, i) => [
    `import file${i} from "./${filePath}" with { type: "file" };`,
    `import gzFile${i} from "./${filePath}.gz" with { type: "file" };`,
  ])
  .join("\n")}
import server from "./server/main";

globalThis.aframe = {
  command: "build",
  publicDir: resolve(import.meta.dir, "public"),
${staticDef.join("\n")}
};

const port = Number(process.env.PORT) || 3000;
console.log(\`Server running @ http://localhost:\${port}\`);
server.listen(port);
`,
  );
}

function getColor(file: string) {
  if (file.endsWith(".js")) return CYAN;
  if (file.endsWith(".ts")) return CYAN;
  if (file.endsWith(".json")) return YELLOW;
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

async function gzipFiles(files: string[]): Promise<void> {
  for (const file of files) await gzipFile(file);
}

async function gzipFile(file: string): Promise<void> {
  await writeFile(`${file}.gz`, "");
  await pipeline(
    createReadStream(file),
    createGzip(),
    createWriteStream(`${file}.gz`),
  );
}

async function listDirFiles(
  dir: string,
  filter: (path: string) => boolean,
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(entry.parentPath, entry.name);

    if (!filter(fullPath)) continue;

    if (entry.isFile()) {
      files.push(fullPath);
    } else if (entry.isDirectory()) {
      const subFiles = await listDirFiles(fullPath, filter);
      files.push(...subFiles);
    }
  }

  return files;
}

type StaticRouteEntry = {
  route: string;
  filePath: string;
  gzPath: string;
  cacheable: boolean;
};
type StaticRouteArray = StaticRouteEntry[];
