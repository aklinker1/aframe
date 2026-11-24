export interface FetchAppOptions {
  /**
   * The directory that contains `server/`. In dev this is the project root
   * (it also holds `app/`, `public/`, `aframe.config.ts`); in prod it is the
   * build output directory (`.output`, holding `public/` and `prerendered/`).
   * Defaults to the parent of the entry file's directory.
   */
  root?: string;
}

export type FetchApp = (
  options?: FetchAppOptions,
) => (request: Request) => Promise<Response>;
