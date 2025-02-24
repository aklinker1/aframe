import * as vite from "vite";
import type { PrerendererOptions } from "@prerenderer/prerenderer";
import { resolve, join, relative } from "node:path/posix";
import { mkdir } from "node:fs/promises";

export type UserConfig = {
  vite?: vite.UserConfigExport;
  prerenderedRoutes?: string[];
  prerenderer?: Partial<PrerendererOptions>;
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
      envPrefix: "APP_",
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
      envDir: rootDir,
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
