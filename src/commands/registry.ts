import type { Command } from "./types.js";

export class CommandRegistry {
  private commands = new Map<string, Command>();
  private aliasMap = new Map<string, string>();

  register(cmd: Command): void {
    this.commands.set(cmd.name, cmd);
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        this.aliasMap.set(alias, cmd.name);
      }
    }
  }

  registerAll(cmds: Command[]): void {
    for (const cmd of cmds) this.register(cmd);
  }

  resolve(name: string): Command | undefined {
    const normalized = name.startsWith("/") ? name : `/${name}`;
    const direct = this.commands.get(normalized);
    if (direct) return direct;
    const aliasTarget = this.aliasMap.get(normalized);
    if (aliasTarget) return this.commands.get(aliasTarget);
    return undefined;
  }

  list(): Command[] {
    return Array.from(this.commands.values());
  }

  byCategory(): Map<string, Command[]> {
    const map = new Map<string, Command[]>();
    for (const cmd of this.commands.values()) {
      const cat = cmd.category || "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(cmd);
    }
    return map;
  }

  names(): string[] {
    return Array.from(this.commands.keys());
  }

  complete(partial: string): string[] {
    const lower = partial.toLowerCase();
    return this.names()
      .filter((n) => n.startsWith(lower))
      .sort();
  }
}
