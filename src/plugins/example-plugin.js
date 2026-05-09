// Example plugin. Drop a copy of this into ~/.loom/plugins/ or .loom/plugins/
// and Loom will auto-load it on startup.
//
// Plugins receive the ToolRegistry and may register additional tools.

import { z } from "zod";

export default function register(registry) {
  registry.register({
    name: "echo",
    description: "Echo back the provided text. Useful as a plugin example.",
    parameters: z.object({ text: z.string() }),
    handler: async ({ text }) => `echo: ${text}`,
  });
}
