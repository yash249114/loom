import type { CommandRegistry } from "./registry.js";

const B = (s: string) => `\x1b[1m${s}\x1b[22m`;
const D = (s: string) => `\x1b[2m${s}\x1b[22m`;
const C = (s: string) => `\x1b[36m${s}\x1b[39m`;
const SEP = D("\u2500".repeat(56));

export function printHelp(registry: CommandRegistry): void {
  const byCat = registry.byCategory();

  console.log(`  ${B("Commands")}`);
  console.log(SEP);
  console.log();

  for (const [category, cmds] of byCat) {
    console.log(`  ${B(category)}`);
    for (const cmd of cmds) {
      const usage = cmd.usage ? ` ${D(cmd.usage)}` : "";
      const aliases = cmd.aliases?.length ? ` ${D(`(${cmd.aliases.join(", ")})`)}` : "";
      console.log(`    ${C(cmd.name.padEnd(16))} ${D(cmd.description)}${aliases}${usage}`);
    }
    console.log();
  }

  console.log(`  ${D("\u2014")} ${D("Or type any task to run it with the AI agent.")}`);
}
