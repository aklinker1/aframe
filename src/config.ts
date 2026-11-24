import { join, relative, resolve } from "node:path/posix";
import type { LaunchOptions } from "puppeteer";
import * as vite from "vite";

export type AframeHooks = {
  afterServerBuild?: (config: ResolvedConfig) => Promise<void> | void;
};

export type UserConfig = {
  vite?: vite.UserConfigExport;
  /**
   * Routes to prerender during `aframe build`. Each must start with `/` and
   * contain no `?` or `#`.
   * @default ["/"]
   */
  prerenderedRoutes?: string[];
  prerender?: PrerenderConfig | false;
  hooks?: AframeHooks;
};

export type PrerenderConfig = {
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
  packageJsonPath: string;
  appDir: string;
  publicDir: string;
  serverDir: string;
  prerenderedDir: string;
  outDir: string;
  serverOutDir: string;
  appOutDir: string;
  vite: vite.InlineConfig;
  prerenderedRoutes: string[];
  prerender: PrerenderConfig | false;
  hooks: AframeHooks | undefined;
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
  const packageJsonPath = join(rootDir, "package.json");
  const appDir = join(rootDir, "app");
  const serverDir = join(rootDir, "server");
  const publicDir = join(rootDir, "public");
  const outDir = join(rootDir, ".output");
  const appOutDir = join(outDir, "public");
  const serverOutDir = join(outDir, "server");
  const prerenderedDir = join(outDir, "prerendered");

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
      configFile: false,
      root: appDir,
      publicDir,
      envDir: rootDir,
      build: {
        emptyOutDir: false,
        outDir: appOutDir,
      },
    },
  );

  return {
    rootDir,
    packageJsonPath,
    appDir,
    publicDir,
    serverDir,
    outDir,
    serverOutDir,
    appOutDir,
    prerenderedDir,

    prerenderedRoutes: userConfig.prerenderedRoutes ?? ["/"],
    vite: viteConfig,
    prerender: userConfig.prerender ?? {},
    hooks: userConfig.hooks,
  };
}
