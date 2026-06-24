import { UiChaosHarness } from "./UiTestHarness.js";
import terminalSizeExperiments from "./experiments/TerminalSizeChaos.js";
import stressExperiments from "./experiments/StressChaos.js";
import corruptionExperiments from "./experiments/CorruptionChaos.js";
import visualExperiments from "./experiments/VisualChaos.js";
import shellExperiments from "./experiments/ShellChaos.js";

async function main() {
  const harness = new UiChaosHarness();

  harness.registerAll([
    ...terminalSizeExperiments,
    ...stressExperiments,
    ...corruptionExperiments,
    ...visualExperiments,
    ...shellExperiments,
  ]);

  console.log("LOOM UI CHAOS ENGINE");
  console.log("=".repeat(60));
  console.log(`Registered ${/* total not tracked */"all"} experiments\n`);

  const report = await harness.runAll();

  UiChaosHarness.printReport(report);

  if (report.failed > 0 || report.crashed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("UI Chaos engine fatal:", err);
  process.exit(1);
});
