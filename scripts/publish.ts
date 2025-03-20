// Publish a new version of this extension. Bump version
//
// Usage:
//
//   bun run scripts/publish.ts [nextVersion]
//   bun run publish [nextVersion]
//
import pkg from "../package.json";
import { BOLD, DIM, GREEN, RESET } from "../src/color";

let nextVersionArg = process.argv[2]?.trim();
if (!nextVersionArg) throw Error("nextVersion not provided");

console.log(
  `${DIM}Next version:${RESET} ${BOLD}${GREEN}${nextVersionArg}${RESET}`,
);
if (pkg.version.startsWith("0.")) {
  if (nextVersionArg === "minor") nextVersionArg = "patch";
  if (nextVersionArg === "major") nextVersionArg = "minor";
}

const res = await Bun.$`npm version ${nextVersionArg} -m "chore(release): %s"`;
const nextVersion = res.text().slice(1);

console.log(`${DIM}${pkg.version}${RESET} → ${GREEN}${nextVersion}${RESET}`);

await Bun.$`bun publish`;
await Bun.$`git push`;
await Bun.$`git push --tags`;
