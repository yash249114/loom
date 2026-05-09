import { nanoid } from "nanoid";

export const newId = (prefix = "") => `${prefix}${nanoid(10)}`;

export function interpolateEnv<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(/\$\{([^}]+)\}/g, (_match, name: string) =>
      process.env[name] ?? ""
    ) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(interpolateEnv) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = interpolateEnv(v);
    return out as unknown as T;
  }
  return value;
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + `…[${s.length - n} more chars]` : s;
}

export function safeJSON<T = unknown>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label = "operation"
): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_res, rej) =>
      setTimeout(
        () => rej(new Error(`${label} timed out after ${ms}ms`)),
        ms
      )
    ),
  ]);
}
