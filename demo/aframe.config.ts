import { join } from "node:path";
import { defineConfig } from "../src";

export default defineConfig({
  prerenderedRoutes: ["/", "/two"],
  hooks: {
    afterServerBuild: async (config) => {
      // Update tsconfig path alias
      const file = Bun.file(join(config.outDir, "tsconfig.json"));
      const text = await file.text();
      const fixedText = text.replace(
        `"../src/client/server"`,
        `"../../src/client/server"`,
      );
      await file.write(fixedText);
    },
  },
});
