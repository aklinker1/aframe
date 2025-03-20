import "vite/client";

declare global {
  interface ImportMeta {
    /**
     * Absolute path or relative path (relative to main server file, not CWD).
     * This ensures the public directory path is constant regardless of the CWD.
     * It allows dev mode, production builds, and preview mode to all run from
     * any working directory.
     */
    publicDir: string;
    command: string;
  }
}

export {};
