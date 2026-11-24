import { dirname, resolve } from "node:path";

export function resolveRoot(root: string | undefined): string {
  if (root) return resolve(root);

  const entry = process.argv[1];
  if (!entry) {
    throw new Error(
      "aframe: couldn't infer the project root; pass fetchApp({ root })",
    );
  }
  return resolve(dirname(entry), "..");
}
