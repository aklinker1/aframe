/**
 * Return's `true` when the app is prerendering (when URL includes `?prerendering`).
 */
export function isPrerendering() {
  return new URL(location.href).searchParams.has("prerendering");
}
