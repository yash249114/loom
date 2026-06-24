import type { Command } from "commander";
import { Indexer } from "./indexer.js";
import { logger } from "../core/logger.js";

export function registerIndexCommand(program: Command): void {
  program
    .command("index")
    .description("Build repository intelligence index (symbols + dependency graph)")
    .option("-f, --force", "Force full reindex (ignore cache)")
    .option("-v, --verbose", "Show detailed progress")
    .action(async (options) => {
      try {
        const root = process.cwd();
        const indexer = new Indexer({
          rootDir: root,
          force: options.force ?? false,
          verbose: options.verbose ?? false,
        });
        const result = await indexer.run(options.force ?? false);
        logger.success(
          `Indexing complete: ${result.files.length} files, ${result.symbols.length} symbols`
        );
        const graphPath = ".loom/graph.json";
        const symbolsPath = ".loom/symbols.json";
        logger.info(`Graph: ${graphPath}`);
        logger.info(`Symbols: ${symbolsPath}`);
      } catch (err: any) {
        logger.error(`Indexing failed: ${err.message}`);
        process.exit(1);
      }
    });
}
