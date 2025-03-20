import "vite/client";

declare global {
  interface ImportMeta {
    /** Absolute path or relative path (relative to main server file, not CWD). */
    publicDir: string;
    command: string;
  }
}

export {};
