import type { BunFile } from "bun";
import "vite/client";

declare global {
  declare var aframe: {
    command: "build" | "serve";
    publicDir: string;
    static?: Record<
      string,
      { file: BunFile; gzFile: BunFile; cacheable: boolean }
    >;
  };
}

export {};
