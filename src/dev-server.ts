import { createServer as createViteServer, type ViteDevServer } from "vite";
import type { ResolvedConfig } from "./config";
import type { Subprocess } from "bun";

export async function createServer(
  config: ResolvedConfig,
): Promise<ViteDevServer> {
  const devServer = await createViteServer(config.vite);
  const ogListen = devServer.listen.bind(devServer);
  const ogClose = devServer.close.bind(devServer);

  let serverProcess: Subprocess | undefined;
  const startServer = () => {
    const js = [
      `import server from '${config.serverModule}';`,
      `server.listen(${config.serverPort});`,
    ].join("\n");
    return Bun.spawn({
      cmd: [
        "bun",
        "--watch",
        "--define",
        `import.meta.publicDir:"${config.publicDir}"`,
        "--define",
        `import.meta.command:"serve"`,
        "--eval",
        js,
      ],
      stdio: ["inherit", "inherit", "inherit"],
      cwd: config.rootDir,
    });
  };

  devServer.listen = async (port, isRestart) => {
    const res = await ogListen(port, isRestart);
    serverProcess = startServer();
    return res;
  };
  devServer.close = async () => {
    void ogClose();
    serverProcess?.kill("SIGINT");
  };

  return devServer;
}
