import "vite/client";

declare global {
  declare var aframe: {
    command: "build" | "serve";
    rootDir: string;
    publicDir: string;
  };
}

export {};
