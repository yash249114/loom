import readline from "node:readline";
import type { CommandRegistry } from "./registry.js";

export function setupCompletion(rl: readline.Interface, registry: CommandRegistry): void {
  const completer = (line: string): [string[], string] => {
    if (line.startsWith("/")) {
      const matches = registry.complete(line);
      return [matches.length ? matches : registry.names(), line];
    }
    return [[], line];
  };

  // Override the completer on the readline interface
  (rl as any).completer = completer;
}
