import * as vite from "vite";
import Prerenderer from "@prerenderer/prerenderer";
import type { PrerendererOptions } from "@prerenderer/prerenderer";
import { resolve, join, relative } from "node:path/posix";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { lstatSync } from "node:fs";
import type { BunPlugin } from "bun";
import { RESET, DIM, GREEN, BLUE, MAGENTA, CYAN, BOLD } from "./color";
import { createTimer } from "./timer";

export async function createServer(
  config: ResolvedConfig,
): Promise<vite.ViteDevServer> {
  return await vite.createServer(config.vite);
}

export async function build(config: ResolvedConfig) {
  const buildTimer = createTimer();

  // Clear outDir
  await rm(config.outDir, { force: true, recursive: true });
  await mkdir(config.outDir, { recursive: true });

  const appTimer = createTimer();
  console.log(
    `${BOLD}${CYAN}ℹ${RESET} Building ${CYAN}./app${RESET} with ${GREEN}Vite ${vite.version}${RESET}`,
  );
  const { output: app } = (await vite.build(
    config.vite,
  )) as vite.Rollup.RollupOutput;
  console.log(`${GREEN}✔${RESET} Built in ${appTimer()}`);

  console.log();

  const serverTimer = createTimer();
  console.log(
    `${BOLD}${CYAN}ℹ${RESET} Building ${CYAN}./server${RESET} with ${MAGENTA}Bun ${Bun.version}${RESET}`,
  );
  const server = await Bun.build({
    outdir: config.serverOutDir,
    sourcemap: "external",
    entrypoints: [config.serverEntry],
    target: "bun",
    define: {
      // In production, the public directory is inside the CWD
      "import.meta.publicDir": `"public"`,
      "import.meta.command": `"build"`,
    },
    plugins: [aframeServerMainBunPlugin(config)],
    throw: true,
  });
  console.log(`${GREEN}✔${RESET} Built in ${serverTimer()}`);

  console.log();

  const prerenderTimer = createTimer();
  console.log(
    `${BOLD}${CYAN}ℹ${RESET} Prerendering...\n` +
      config.prerenderedRoutes
        .map((route) => `  ${DIM}-${RESET} ${CYAN}${route}${RESET}`)
        .join("\n"),
  );
  const prerenderer = new Prerenderer(await config.prerenderer());
  const prerendered = await prerenderer
    .initialize()
    .then(() => prerenderer.renderRoutes(config.prerenderedRoutes))
    .then((renderedRoutes) =>
      Promise.all(
        renderedRoutes.map(async (route) => {
          const dir = join(config.prerenderToDir, route.route);
          const file = join(dir, "index.html");
          await mkdir(dir, { recursive: true });
          await writeFile(file, route.html.trim());
          return {
            ...route,
            file,
          };
        }),
      ),
    )
    .catch((err) => {
      throw err;
    })
    .finally(() => {
      prerenderer.destroy();
    });
  console.log(`${GREEN}✔${RESET} Prerendered in ${prerenderTimer()}`);

  console.log();

  console.log(`${GREEN}✔${RESET} Application built in ${buildTimer()}`);
  const relativeOutDir = `${relative(config.rootDir, config.outDir)}/`;
  const files = [
    ...server.outputs.map((output) => output.path),
    ...prerendered.map((output) => output.file),
    ...app
      .filter((output) => output.fileName !== "index.html")
      .map((output) => join(config.appOutDir, output.fileName)),
  ].map((file): [file: string, size: number] => [
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
  if (file.endsWith(".js.map")) return DIM;
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

///
/// CONFIG
///

export type UserConfig = {
  vite?: vite.UserConfigExport;
  prerenderedRoutes?: string[];
  prerenderer?: PrerendererOptions;
};

export type ResolvedConfig = {
  rootDir: string;
  appDir: string;
  publicDir: string;
  serverDir: string;
  serverModule: string;
  serverEntry: string;
  prerenderToDir: string;
  outDir: string;
  serverOutDir: string;
  appOutDir: string;
  appPort: number;
  serverPort: number;
  vite: vite.InlineConfig;
  prerenderedRoutes: string[];
  prerenderer: () => Promise<PrerendererOptions>;
};

export function defineConfig(config: UserConfig): UserConfig {
  return config;
}

export async function resolveConfig(
  root: string | undefined,
  command: "build" | "serve",
  mode: string,
): Promise<ResolvedConfig> {
  const rootDir = root ? resolve(root) : process.cwd();
  const appDir = join(rootDir, "app");
  const serverDir = join(rootDir, "server");
  const serverModule = join(serverDir, "main.ts");
  const serverEntry = join(import.meta.dir, "server-entry.ts");
  const publicDir = join(rootDir, "public");
  const outDir = join(rootDir, ".output");
  const appOutDir = join(outDir, "public");
  const serverOutDir = outDir;
  const prerenderToDir = appOutDir;
  const appPort = 3000;
  const serverPort = 3001;

  // Ensure required directories exist
  await mkdir(prerenderToDir, { recursive: true });

  const configFile = join(rootDir, "aframe.config"); // No file extension to resolve any JS/TS file
  const relativeConfigFile = "./" + relative(import.meta.dir, configFile);
  const { default: userConfig }: { default: UserConfig } = await import(
    relativeConfigFile
  );

  let viteConfig = await vite.defineConfig((await userConfig.vite) ?? {});
  if (typeof viteConfig === "function") {
    viteConfig = await viteConfig({ command, mode });
  }
  // Apply opinionated config that can be overwritten

  viteConfig = vite.mergeConfig<vite.InlineConfig, vite.InlineConfig>(
    // Defaults
    {
      build: {
        emptyOutDir: true,
      },
    },
    // Overrides
    viteConfig,
  );

  // Override required config
  viteConfig = vite.mergeConfig<vite.InlineConfig, vite.InlineConfig>(
    // Defaults
    viteConfig,
    // Overrides
    {
      logLevel: "warn",
      configFile: false,
      root: appDir,
      publicDir,
      build: {
        outDir: appOutDir,
      },
      server: {
        port: appPort,
        strictPort: true,
        proxy: {
          "/api": {
            target: `http://localhost:${serverPort}`,
            changeOrigin: true,
          },
        },
      },
    },
  );

  const prerenderer = async (): Promise<PrerendererOptions> => {
    const rendererModule =
      tryResolve("@prerenderer/renderer-puppeteer") ??
      tryResolve("@prerenderer/renderer-jsdom");
    if (!rendererModule)
      throw Error(
        `No renderer installed. Did you forget to install @prerenderer/renderer-puppeteer or @prerenderer/renderer-jsdom?`,
      );

    const { default: Renderer } = await import(rendererModule);
    const renderer = new Renderer();
    return {
      ...userConfig.prerenderer,
      renderer,
      staticDir: appOutDir,
    };
  };

  return {
    rootDir,
    appDir,
    publicDir,
    serverDir,
    serverModule,
    serverEntry,
    outDir,
    serverOutDir,
    appOutDir,
    prerenderToDir,
    appPort,
    serverPort,

    prerenderedRoutes: userConfig.prerenderedRoutes ?? ["/"],
    prerenderer,
    vite: viteConfig,
  };
}

function tryResolve(specifier: string): string | undefined {
  try {
    return import.meta.resolve(specifier);
  } catch {
    return undefined;
  }
}
