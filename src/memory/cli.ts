import type { Command } from "commander";
import chalk from "chalk";
import { MemoryPipeline } from "./pipeline.js";
import { logger } from "../core/logger.js";
import { workspaceLayout } from "../workspace/workspace.js";

export function registerMemoryCommands(program: Command): void {
  const memory = program
    .command("graph")
    .description("Workspace graph management");

  memory
    .command("index")
    .description("Index workspace and build symbol/dependency graph")
    .option("-f, --force", "Force full re-index")
    .action(async (options) => {
      const root = process.cwd();
      const pipeline = new MemoryPipeline({ rootDir: root, verbose: true });
      await pipeline.init();
      const result = await pipeline.index(options.force);
      console.log(JSON.stringify(result, null, 2));
    });

  memory
    .command("stats")
    .description("Show graph statistics")
    .action(async () => {
      const root = process.cwd();
      const pipeline = new MemoryPipeline({ rootDir: root });
      await pipeline.init();
      const stats = pipeline.getStats();
      console.log(chalk.bold("\nGraph Statistics:"));
      console.log(`  Files:     ${stats.graph.fileCount}`);
      console.log(`  Symbols:   ${stats.graph.symbolCount}`);
      console.log(`  Edges:     ${stats.graph.edgeCount}`);
      console.log(chalk.bold("\nMemory:"));
      console.log(`  Observations: ${stats.memory.total}`);
      console.log(`  By type: ${JSON.stringify(stats.memory.byType)}`);
      console.log(chalk.bold("\nArchitecture:"));
      console.log(`  ADRs:    ${stats.arch.adrs}`);
      console.log(`  Patterns: ${stats.arch.patterns}`);
      if (stats.lastIndexDuration > 0) {
        console.log(`\n  Last index: ${stats.lastIndexDuration}ms`);
      }
      console.log();
    });

  memory
    .command("search <query>")
    .description("Search across graph, memory, and architecture")
    .option("-l, --limit <n>", "Max results per category", "20")
    .option("--json", "Output as JSON")
    .action(async (query, options) => {
      const root = process.cwd();
      const pipeline = new MemoryPipeline({ rootDir: root });
      await pipeline.init();
      const results = await pipeline.searchAll(query, parseInt(options.limit, 10));
      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }
      console.log(chalk.bold(`\nSymbols (${results.symbols.length}):`));
      for (const sym of results.symbols.slice(0, 10)) {
        const name = (sym as any).name ?? sym;
        const file = (sym as any).file ?? "";
        console.log(`  ${chalk.cyan(name)}  ${chalk.gray(file)}`);
      }
      console.log(chalk.bold(`\nMemory (${results.memory.length}):`));
      for (const obs of results.memory.slice(0, 10)) {
        console.log(`  [${obs.type.padEnd(14)}] ${obs.content.slice(0, 80)}`);
      }
      console.log(chalk.bold(`\nArchitecture (${results.arch.length}):`));
      for (const adr of results.arch.slice(0, 5)) {
        const adrEntry = adr as any;
        console.log(`  ${chalk.yellow(adrEntry.title)} (${adrEntry.status})`);
      }
      console.log();
    });

  memory
    .command("analyze <module>")
    .description("Analyze a module's graph properties")
    .option("--json", "Output as JSON")
    .action(async (module, options) => {
      const root = process.cwd();
      const pipeline = new MemoryPipeline({ rootDir: root });
      await pipeline.init();
      const analysis = pipeline.workspaceGraph.analyze(module);
      if (options.json) {
        console.log(JSON.stringify(analysis, null, 2));
        return;
      }
      console.log(chalk.bold(`\nAnalysis: ${module}`));
      console.log(`  Reachable symbols:  ${analysis.reachableSymbols.length}`);
      console.log(`  Transitive closure: ${analysis.transitiveClosure.length}`);
      console.log(`  Cycles:             ${analysis.cycles.length}`);
      console.log(`  Critical path:      ${analysis.criticalPath.length} hops`);
      console.log(`  Importance score:   ${analysis.importanceScore.toFixed(3)}`);
      console.log(`  Coupling:           ${analysis.coupling.toFixed(3)}`);
      console.log(`  Cohesion:           ${analysis.cohesion.toFixed(3)}`);
      console.log(`  Fan-out:            ${analysis.fanOut}`);
      console.log(`  Fan-in:             ${analysis.fanIn}`);
      console.log();
    });

  memory
    .command("path <from> <to>")
    .description("Find shortest path between two symbols")
    .action(async (from, to) => {
      const root = process.cwd();
      const pipeline = new MemoryPipeline({ rootDir: root });
      await pipeline.init();
      const path = pipeline.workspaceGraph.findPath(from, to);
      if (path.length === 0) {
        logger.info("No path found.");
        return;
      }
      console.log(chalk.bold(`\nPath (${path.length - 1} hops):`));
      for (let i = 0; i < path.length; i++) {
        const prefix = i === 0 ? "from" : i === path.length - 1 ? "to  " : "    ";
        console.log(`  ${prefix} ${chalk.cyan(path[i])}`);
      }
      console.log();
    });

  memory
    .command("cycles")
    .description("Detect circular dependencies in the graph")
    .action(async () => {
      const root = process.cwd();
      const pipeline = new MemoryPipeline({ rootDir: root });
      await pipeline.init();
      const cycles = pipeline.workspaceGraph.findCycles();
      if (cycles.length === 0) {
        logger.success("No circular dependencies found.");
        return;
      }
      console.log(chalk.bold(`\n${cycles.length} cycle(s) found:`));
      for (const cycle of cycles) {
        console.log(`  ${cycle.join(" → ")}`);
      }
      console.log();
    });

  memory
    .command("critical-path")
    .description("Find the critical dependency path in the graph")
    .action(async () => {
      const root = process.cwd();
      const pipeline = new MemoryPipeline({ rootDir: root });
      await pipeline.init();
      const path = pipeline.workspaceGraph.getCriticalPath();
      if (path.length === 0) {
        logger.info("No critical path found.");
        return;
      }
      console.log(chalk.bold(`\nCritical path (${path.length} nodes):`));
      for (const node of path) {
        console.log(`  ${chalk.red(node)}`);
      }
      console.log();
    });

  const obs = program
    .command("observe")
    .alias("mem")
    .description("Long-term project memory management");

  obs
    .command("list")
    .description("List all observations")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const root = process.cwd();
      const pipeline = new MemoryPipeline({ rootDir: root });
      await pipeline.init();
      const all = await pipeline.longTermMemory.getAll();
      if (options.json) {
        console.log(JSON.stringify(all, null, 2));
        return;
      }
      if (all.length === 0) {
        logger.info("No observations.");
        return;
      }
      console.log(chalk.bold(`\nObservations (${all.length}):`));
      for (const obs of all) {
        const date = new Date(obs.timestamp).toISOString().slice(0, 10);
        console.log(`  [${date}] [${obs.type.padEnd(14)}] ${obs.content.slice(0, 80)}`);
      }
      console.log();
    });

  obs
    .command("query <text>")
    .description("Query project memory")
    .option("-t, --types <types>", "Comma-separated observation types")
    .option("-l, --limit <n>", "Max results", "20")
    .option("--json", "Output as JSON")
    .action(async (text, options) => {
      const root = process.cwd();
      const pipeline = new MemoryPipeline({ rootDir: root });
      await pipeline.init();
      const results = await pipeline.longTermMemory.query({
        text,
        types: options.types ? options.types.split(",") : undefined,
        limit: parseInt(options.limit, 10),
      });
      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }
      if (results.length === 0) {
        logger.info("No matching observations.");
        return;
      }
      console.log(chalk.bold(`\nMatching observations (${results.length}):`));
      for (const r of results) {
        const date = new Date(r.observation.timestamp).toISOString().slice(0, 10);
        console.log(`  [${date}] [${r.observation.type.padEnd(14)}] ${r.observation.content.slice(0, 80)}`);
      }
      console.log();
    });

  obs
    .command("clear")
    .description("Clear all observations")
    .action(async () => {
      const root = process.cwd();
      const pipeline = new MemoryPipeline({ rootDir: root });
      await pipeline.init();
      await pipeline.longTermMemory.clear();
      logger.success("Memory cleared.");
    });

  const arch = program
    .command("arch")
    .description("Architecture knowledge base management");

  arch
    .command("adr")
    .description("List all architecture decisions")
    .option("--status <status>", "Filter by status")
    .option("--tag <tag>", "Filter by tag")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const root = process.cwd();
      const pipeline = new MemoryPipeline({ rootDir: root });
      await pipeline.init();
      const adrs = options.status
        ? pipeline.architectureKnowledge.getADRsByStatus(options.status)
        : options.tag
          ? pipeline.architectureKnowledge.getADRsByTag(options.tag)
          : pipeline.architectureKnowledge.getAllADRs();
      if (options.json) {
        console.log(JSON.stringify(adrs, null, 2));
        return;
      }
      if (adrs.length === 0) {
        logger.info("No ADRs.");
        return;
      }
      console.log(chalk.bold(`\nArchitecture Decisions (${adrs.length}):`));
      for (const adr of adrs) {
        const date = new Date(adr.createdAt).toISOString().slice(0, 10);
        const status = adr.status === "accepted" ? chalk.green(adr.status) :
                       adr.status === "proposed" ? chalk.yellow(adr.status) :
                       chalk.red(adr.status);
        console.log(`  ${chalk.cyan(adr.id)} ${status}  ${date}`);
        console.log(`    ${adr.title}`);
        console.log(`    ${chalk.gray(adr.context.slice(0, 100))}`);
      }
      console.log();
    });

  arch
    .command("adr-create")
    .description("Create a new architecture decision record")
    .requiredOption("-t, --title <title>", "ADR title")
    .requiredOption("-c, --context <context>", "Context/background")
    .option("-d, --decision <decision>", "The decision made")
    .option("-s, --status <status>", "Status: proposed|accepted|deprecated|superseded", "proposed")
    .option("--tag <tags>", "Comma-separated tags")
    .action(async (options) => {
      const root = process.cwd();
      const pipeline = new MemoryPipeline({ rootDir: root });
      await pipeline.init();
      const adr = await pipeline.architectureKnowledge.addADR({
        title: options.title,
        context: options.context,
        decision: options.decision || options.context,
        status: options.status,
        rationale: "",
        reasoning: "",
        tags: options.tag ? options.tag.split(",") : [],
        consequences: [],
        files: [],
        symbols: [],
        timestamp: Date.now(),
      });
      logger.success(`Created ADR: ${adr.id}`);
      console.log(JSON.stringify(adr, null, 2));
    });

  arch
    .command("adr-update <id>")
    .description("Update an ADR status")
    .requiredOption("-s, --status <status>", "New status")
    .option("-r, --reason <reason>", "Reason for update")
    .action(async (id, options) => {
      const root = process.cwd();
      const pipeline = new MemoryPipeline({ rootDir: root });
      await pipeline.init();
      const adr = await pipeline.architectureKnowledge.updateADRStatus(id, options.status, options.reason);
      if (!adr) {
        logger.error(`ADR '${id}' not found.`);
        return;
      }
      logger.success(`Updated ${id} to ${options.status}`);
    });

  arch
    .command("adr-delete <id>")
    .description("Delete an ADR")
    .action(async (id) => {
      const root = process.cwd();
      const pipeline = new MemoryPipeline({ rootDir: root });
      await pipeline.init();
      await pipeline.architectureKnowledge.deleteADR(id);
      logger.success(`Deleted ${id}`);
    });

  arch
    .command("patterns")
    .description("Detect architecture patterns in the workspace")
    .action(async () => {
      const root = process.cwd();
      const pipeline = new MemoryPipeline({ rootDir: root });
      await pipeline.init();
      const stats = pipeline.workspaceGraph.getStats();
      const allSyms = pipeline.workspaceGraph.searchSymbols({ limit: 10000 });
      const allFiles = Array.from(new Set(allSyms.map(s => s.file)));
      const patterns = pipeline.architectureKnowledge.detectPatterns(
        allFiles,
        allSyms.map(s => s.name)
      );
      if (patterns.length === 0) {
        logger.info("No patterns detected.");
        return;
      }
      console.log(chalk.bold(`\nDetected Patterns (${patterns.length}):`));
      for (const p of patterns) {
        const pct = (p.confidence * 100).toFixed(0);
        console.log(`  ${chalk.cyan(p.pattern.name)}  ${pct}%`);
        console.log(`    ${chalk.gray(p.pattern.description)}`);
        for (const ev of p.evidence.slice(0, 3)) {
          console.log(`    ${chalk.gray("  ↳ " + ev)}`);
        }
      }
      console.log();
    });

  const ctx = program
    .command("context")
    .description("Context engine operations");

  ctx
    .command("build")
    .description("Build an enriched context for a query")
    .requiredOption("-q, --query <query>", "The query to build context for")
    .option("-f, --files <files>", "Comma-separated file paths")
    .option("-s, --symbols <symbols>", "Comma-separated symbol names")
    .option("-i, --instructions <instructions>", "Custom instructions")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const root = process.cwd();
      const pipeline = new MemoryPipeline({ rootDir: root });
      await pipeline.init();
      const ctx = await pipeline.buildContext({
        query: options.query,
        workspace: root,
        maxTokens: 24000,
        files: options.files ? options.files.split(",") : undefined,
        symbols: options.symbols ? options.symbols.split(",") : undefined,
        instructions: options.instructions,
      });
      if (options.json) {
        console.log(JSON.stringify(ctx, null, 2));
        return;
      }
      console.log(chalk.bold(`\nContext for: ${options.query}`));
      console.log(`  Graph: ${ctx.graph.nodes} nodes, ${ctx.graph.edges} edges, ${ctx.graph.files} files`);
      console.log(`  Budget: ${ctx.budget.used}/${ctx.budget.total} tokens`);
      console.log(`  Packages: ${ctx.packages.length}`);
      for (const pkg of ctx.packages) {
        console.log(`    [${pkg.type}] ${pkg.tokens} tokens (p${pkg.priority})`);
      }
      if (ctx.summary) {
        console.log(`\n${chalk.gray(ctx.summary)}`);
      }
    });

  const pipelineCmd = program
    .command("pipeline")
    .description("Unified memory pipeline operations");

  pipelineCmd
    .command("status")
    .description("Show pipeline status and statistics")
    .action(async () => {
      const root = process.cwd();
      const pipeline = new MemoryPipeline({ rootDir: root, verbose: true });
      await pipeline.init();
      console.log(chalk.bold("\nPipeline Status:"));
      console.log(`  Graph loaded:     ${pipeline.workspaceGraph.getStats().fileCount > 0}`);
      console.log(`  Memory loaded:    ${pipeline.longTermMemory.getStats().total > 0}`);
      console.log(`  Arch loaded:      ${pipeline.architectureKnowledge.getAllADRs().length > 0}`);
      console.log(`\n  Run ${chalk.cyan("loom graph index")} to index the workspace.`);
    });
}
