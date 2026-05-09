import { ToolRegistry } from "./registry.js";
import {
  readFileTool,
  writeFileTool,
  editFileTool,
  patchFileTool,
  listDirTool,
} from "./file-tools.js";
import { searchFilesTool } from "./search-tools.js";
import { createShellTool } from "./shell-tool.js";
import type { LoomConfig } from "../core/types.js";

export function buildDefaultRegistry(config: LoomConfig): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(readFileTool);
  registry.register(writeFileTool);
  registry.register(editFileTool);
  registry.register(patchFileTool);
  registry.register(listDirTool);
  registry.register(searchFilesTool);
  registry.register(
    createShellTool({
      blockedCommands: config.safety.blockedCommands,
      sandbox: config.safety.sandbox,
    })
  );
  return registry.filter(config.tools.enabled);
}

export { ToolRegistry } from "./registry.js";
