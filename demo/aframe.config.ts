import { join } from "node:path";
import { defineConfig } from "../src";

export default defineConfig({
  prerenderedRoutes: ["/", "/two"],
  hooks: {
    afterServerBuild: async (config) => {
      const file = Bun.file(join(config.outDir, "tsconfig.json"));
      const text = await file.text();
      const fixedText = text.replaceAll(
        `"../src/client/dev"`,
        `"../../src/client/server"`,
      );
      await file.write(fixedText);
    },
  },
});
