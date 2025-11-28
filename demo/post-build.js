import { join } from "node:path";

const file = Bun.file(join(import.meta.dir, ".output/tsconfig.json"));

const text = await file.text();
const fixedText = text.replace(
  `"../src/client/server"`,
  `"../../src/client/server"`,
);

await file.write(fixedText);
