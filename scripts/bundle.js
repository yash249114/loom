import * as esbuild from "esbuild";

async function main() {
  console.log(`[bundle] Building loom CLI bundle...`);

  const result = await esbuild.build({
    entryPoints: ["src/cli/index.ts"],
    outfile: "bundle/loom.cjs",
    bundle: true,
    platform: "node",
    target: ["node18"],
    format: "cjs",
    // Shebang is preserved from source entry file
    external: [
      // Ink + React kept external for npm package (not needed in CLI-only mode)
      "ink",
      "ink-spinner",
      "ink-text-input",
      "react",
      "react/jsx-runtime",
    ],
    jsx: "automatic",
    jsxImportSource: "react",
    sourcemap: true,
    minify: true,
    legalComments: "none",
  });

  if (result.errors.length > 0) {
    console.error("[bundle] Errors:");
    for (const e of result.errors) console.error(`  ${e.text}`);
    process.exit(1);
  }

  const bytes = result.metafile?.outputs?.["bundle/loom.cjs"]?.bytes ?? 0;
  console.log(`[bundle] → bundle/loom.cjs (${(bytes / 1024).toFixed(0)} KB)`);

  if (result.warnings.length > 0) {
    console.warn(`[bundle] Warnings:`);
    for (const w of result.warnings) console.warn(`  ${w.text}`);
  }

  console.log(`[bundle] ✓ Bundle complete.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
