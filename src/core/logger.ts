import chalk from "chalk";

let verbose = false;
export const setVerbose = (v: boolean) => {
  verbose = v;
};

export const logger = {
  info: (m: string) => console.log(chalk.cyan("ℹ"), m),
  success: (m: string) => console.log(chalk.green("✓"), m),
  warn: (m: string) => console.log(chalk.yellow("⚠"), m),
  error: (m: string) => console.error(chalk.red("✗"), m),
  debug: (m: string) => verbose && console.log(chalk.gray("·"), m),
  raw: (m: string) => console.log(m),
};
