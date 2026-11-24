import { createServer } from "node:net";

export function findFreePort(host = "127.0.0.1"): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (address == null || typeof address === "string") {
        server.close();
        return reject(new Error("Could not determine free port"));
      }
      server.close(() => resolve(address.port));
    });
  });
}

export function isPortFree(port: number, host?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, host, () => server.close(() => resolve(true)));
  });
}
