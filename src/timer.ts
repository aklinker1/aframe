export function createTimer() {
  const start = performance.now();
  return () => {
    const duration = performance.now() - start;
    if (duration > 1e3) return `${(duration / 1e3).toFixed(3)} s`;
    return `${duration.toFixed(3)} ms`;
  };
}
