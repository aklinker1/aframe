import "vite/client";

declare global {
  interface ImportMeta {
    publicDir: string;
    command: string;
  }
}

export {};
