/**
 * Return's `true` when the app is prerendering.
 */
export function isPrerendering() {
  return !!globalThis.__AFRAME_PRERENDERING;
}

declare global {
  var __AFRAME_PRERENDERING: boolean;
}
