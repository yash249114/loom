import { ChaosTestHarness } from "./ChaosTestHarness.js";
import configChaosExperiments from "./experiments/ConfigChaos.js";
import sessionChaosExperiments from "./experiments/SessionChaos.js";
import providerChaosExperiments from "./experiments/ProviderChaos.js";
import repositoryChaosExperiments from "./experiments/RepositoryChaos.js";
import networkChaosExperiments from "./experiments/NetworkChaos.js";
import memoryChaosExperiments from "./experiments/MemoryChaos.js";

async function main() {
  const harness = new ChaosTestHarness();

  harness.registerAll([
    ...configChaosExperiments,
    ...sessionChaosExperiments,
    ...providerChaosExperiments,
    ...repositoryChaosExperiments,
    ...networkChaosExperiments,
    ...memoryChaosExperiments,
  ]);

  console.log("LOOM CHAOS ENGINE");
  console.log("=".repeat(60));
  console.log(`Registered ${harness.experimentCount} experiments\n`);

  const report = await harness.runAll();

  ChaosTestHarness.printReport(report);

  if (report.failed > 0 || report.crashed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Chaos engine fatal:", err);
  process.exit(1);
});
