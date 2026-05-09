import { execa } from "execa";
import { z } from "zod";
import type { ToolDefinition } from "../core/types.js";
import { truncate } from "../core/util.js";

export function createShellTool(opts: {
  blockedCommands: string[];
  sandbox: boolean;
}): ToolDefinition {
  return {
    name: "shell",
    description:
      "Execute a shell command in the workspace. Output is captured (stdout+stderr). Use for builds, tests, git, package managers, etc.",
    parameters: z.object({
      command: z.string().describe("The shell command to execute"),
      cwd: z
        .string()
        .optional()
        .describe("Working directory relative to workspace root"),
      timeoutMs: z
        .number()
        .int()
        .positive()
        .optional()
        .default(120000),
    }),
    dangerous: true,
    handler: async ({ command, cwd, timeoutMs }, ctx) => {
      for (const blocked of opts.blockedCommands) {
        if (command.includes(blocked)) {
          throw new Error(`Blocked command pattern: '${blocked}'`);
        }
      }
      if (opts.sandbox) {
        return `[sandbox] Would execute: ${command}`;
      }
      const ok = await ctx.confirm(`Run shell command: \`${command}\` ?`);
      if (!ok) return "Command cancelled by user.";

      ctx.log(`$ ${command}`);

      try {
        const result = await execa(command, {
          shell: true,
          cwd: cwd ? `${ctx.workspaceRoot}/${cwd}` : ctx.workspaceRoot,
          timeout: timeoutMs,
          all: true,
          reject: false,
        });
        const output = result.all ?? `${result.stdout}\n${result.stderr}`;
        const exitInfo = `[exit ${result.exitCode ?? 0}${result.timedOut ? " TIMEOUT" : ""}]`;
        return `${exitInfo}\n${truncate(output, 50000)}`;
      } catch (e: any) {
        return `[error] ${e.message}`;
      }
    },
  };
}
