import * as vite from "vite";
import { resolve, join, relative } from "node:path/posix";
import type { LaunchOptions } from "puppeteer";

export type UserConfig = {
  vite?: vite.UserConfigExport;
  /**
   * Paths for vite to proxy to the backend during development.
   * @default ["/api"]
   */
  proxyPaths?: string[];
  prerenderedRoutes?: string[];
  prerenderer?: PrerendererConfig | false;
  appPort?: number;
  serverPort?: number;
};

export type PrerendererConfig = {
  /** Wait for an selector`document.querySelector` to be in the DOM before grabbing the HTML. */
  waitForSelector?: string;
  /** When `waitForSelector` is set, also wait for the element to be visible before grabbing the HTML. */
  waitForSelectorVisible?: boolean;
  /** Wait a set timeout in milliseconds before grabbing the HTML. */
  waitForTimeout?: number;
  /**
   * Timeout before prerendering throws an error.
   * @default 30e3
   */
  timeout?: number;
  /** Configure puppeteer's launch options. */
  launch?: LaunchOptions;
};

export type ResolvedConfig = {
  rootDir: string;
  appDir: string;
  publicDir: string;
  serverDir: string;
  serverModule: string;
  serverEntry: string;
  prerenderedDir: string;
  proxyPaths: string[];
  outDir: string;
  serverOutDir: string;
  appOutDir: string;
  appPort: number;
  serverPort: number;
  vite: vite.InlineConfig;
  prerenderedRoutes: string[];
  prerenderer: PrerendererConfig | false;
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
  const prerenderedDir = join(outDir, "prerendered");

  const configFile = join(rootDir, "aframe.config"); // No file extension to resolve any JS/TS file
  const relativeConfigFile = "./" + relative(import.meta.dir, configFile);
  const { default: userConfig }: { default: UserConfig } = await import(
    relativeConfigFile
  );

  const appPort = userConfig.appPort || 3000;
  const serverPort = userConfig.serverPort || 3001;

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
  const proxyPaths = userConfig.proxyPaths ?? ["/api"];
  const proxy: Record<string, string | vite.ProxyOptions> = {};
  proxyPaths.forEach((path) => {
    proxy[path] = {
      target: `http://localhost:${serverPort}`,
      changeOrigin: true,
    };
  });
  viteConfig = vite.mergeConfig<vite.InlineConfig, vite.InlineConfig>(
    // Defaults
    viteConfig,
    // Overrides
    {
      configFile: false,
      root: appDir,
      publicDir,
      envDir: rootDir,
      build: {
        emptyOutDir: false,
        outDir: appOutDir,
      },
      server: {
        port: appPort,
        strictPort: true,
        proxy,
      },
    },
  );

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
    prerenderedDir,
    appPort,
    serverPort,
    proxyPaths,

    prerenderedRoutes: userConfig.prerenderedRoutes ?? ["/"],
    vite: viteConfig,
    prerenderer: userConfig.prerenderer ?? {},
  };
}
