export const B = (s: string) => `\x1b[1m${s}\x1b[22m`;
export const D = (s: string) => `\x1b[2m${s}\x1b[22m`;
export const G = (s: string) => `\x1b[32m${s}\x1b[39m`;
export const R = (s: string) => `\x1b[31m${s}\x1b[39m`;
export const Y = (s: string) => `\x1b[33m${s}\x1b[39m`;
export const C = (s: string) => `\x1b[36m${s}\x1b[39m`;
export const M = (s: string) => `\x1b[35m${s}\x1b[39m`;
export const SEP = D("\u2500".repeat(56));
export const LOOM = `${C("\u2318")} ${B("Loom")}`;
export const PKG_VERSION = "0.1.0";

export function elapsedMs(t0: number): string {
  const ms = Date.now() - t0;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
