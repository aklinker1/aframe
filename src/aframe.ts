#!/usr/bin/env bun
import { statSync } from "node:fs";
import { build } from "../src";
import { resolveConfig } from "../src/config";

const [_bun, _aframe, ...args] = process.argv;

const USAGE = `Usage: aframe build [root]

Commands:
  build [root]   Build and prerender the app into {root}/.output`;

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}

const [command, root] = args;
if (command === "build") {
  const config = await resolveConfig(root, "build", "production");
  await build(config);
} else if (command == null || command === "dev" || isDirectory(command)) {
  console.error(
    'The dev command was removed in v3. Run "bun --watch --conditions aframe-dev server/main.ts" instead (see the migration guide).',
  );
  process.exit(1);
} else {
  console.error(`Unknown command: ${command}\n\n${USAGE}`);
  process.exit(1);
}
