import type { Subprocess } from "bun";

export const SERVER_HINT =
  "server/main.ts must default-export an object with fetch() and must not set its own port";

export interface ServerProcessOptions {
  cmd: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  port: number;
  timeout: number;
  killTimeout?: number;
}

export async function withServerProcess<T>(
  options: ServerProcessOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const child = Bun.spawn({
    cmd: options.cmd,
    cwd: options.cwd,
    env: options.env,
    stdio: ["inherit", "inherit", "inherit"],
  });

  try {
    await waitForServer(child, options.port, options.timeout);
    return await fn();
  } finally {
    await stopServer(child, options.killTimeout ?? 3000);
  }
}

async function waitForServer(
  child: Subprocess,
  port: number,
  timeout: number,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (child.exitCode !== null) throw earlyExitError(child.exitCode);

    const ready = await Promise.race([
      probe(port),
      child.exited.then(() => false),
    ]);
    if (child.exitCode !== null) throw earlyExitError(child.exitCode);
    if (ready) return;

    await sleep(100, child.exited);
  }
  throw new Error(`Server did not respond within ${timeout}ms. ${SERVER_HINT}`);
}

function earlyExitError(code: number | null): Error {
  return new Error(
    `Server exited with code ${code} before it started. ${SERVER_HINT}`,
  );
}

async function probe(port: number): Promise<boolean> {
  try {
    await fetch(`http://localhost:${port}/`, {
      redirect: "manual",
      signal: AbortSignal.timeout(1000),
    });
    return true;
  } catch {
    return false;
  }
}

async function stopServer(child: Subprocess, killTimeout: number) {
  if (child.exitCode !== null) return;

  child.kill("SIGTERM");
  const exited = await Promise.race([
    child.exited.then(() => true),
    sleep(killTimeout).then(() => false),
  ]);
  if (!exited) {
    child.kill("SIGKILL");
    await child.exited;
  }
}

function sleep(ms: number, until?: Promise<unknown>): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
    until?.then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}
