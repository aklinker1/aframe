import { expect, it } from "bun:test";
import { findFreePort } from "../net";
import { withServerProcess } from "../server-process";

async function run(script: string, timeout: number) {
  const port = await findFreePort();
  return withServerProcess(
    {
      cmd: [process.execPath, "-e", script],
      env: { ...process.env, PORT: String(port) },
      port,
      timeout,
      killTimeout: 300,
    },
    async () => "ready",
  );
}

it("should fail fast when the child exits before responding", async () => {
  await expect(run("process.exit(3)", 10e3)).rejects.toThrow(
    "exited with code 3",
  );
});

it("should kill a child that ignores SIGTERM", async () => {
  const script = `process.on("SIGTERM", () => {});
    Bun.serve({ port: Number(process.env.PORT), fetch: () => new Response("ok") });`;
  expect(await run(script, 10e3)).toBe("ready");
});
