import type readline from "node:readline";

export interface CommandContext {
  cwd: string;
  config: import("../core/types.js").LoomConfig;
  branch: string;
  rl: readline.Interface;
  agent: import("../agent/agent.js").Agent | null;
}

export interface Command {
  name: string;
  description: string;
  category: string;
  usage?: string;
  aliases?: string[];
  handler: (args: string, ctx: CommandContext) => Promise<void> | void;
}
