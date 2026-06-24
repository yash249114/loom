/**
 * Create a Node.js Single Executable Application (SEA) config.
 *
 * Node 20+ supports SEA natively. This generates the JSON config
 * and prints instructions for building the binary on each platform.
 *
 * Usage:
 *   node scripts/pkg-sea.js
 *
 * Then follow the printed instructions.
 */

const { writeFileSync } = require("node:fs");

const config = {
  main: "bundle/loom.mjs",
  output: "sea-prep.blob",
  disableExperimentalSEAWarning: true,
};

writeFileSync("sea-config.json", JSON.stringify(config, null, 2));

console.log(`
╔══════════════════════════════════════════════════════════════╗
║              Loom Single Executable Application             ║
╚══════════════════════════════════════════════════════════════╝

Generated sea-config.json for Node.js SEA.

To build a standalone binary on your platform:

  1. Ensure bundle/loom.mjs exists (run: pnpm build:bundle)
  2. Generate the SEA blob:
       node --experimental-sea-config sea-config.json

  3. Copy your Node.js binary:
       copy "%ProgramFiles%\\nodejs\\node.exe" loom.exe       (Windows)
       cp $(which node) loom                                  (macOS/Linux)

  4. Remove the binary's signature (macOS only):
       codesign --remove-signature loom

  5. Inject the SEA blob:
       npx postject loom.exe NODE_SEA_BLOB sea-prep.blob \\
         --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
       (Windows)

       npx postject loom NODE_SEA_BLOB sea-prep.blob \\
         --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
       (macOS/Linux)

  6. Sign the binary (macOS only):
       codesign --sign - loom

The resulting loom / loom.exe is a standalone binary with no
external Node.js dependency.

See: https://nodejs.org/api/single-executable-applications.html
`);
