import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

export interface WorkspaceLayout {
  root: string;
  loomDir: string;
  configFile: string;
  sessionsDir: string;
  memoryFile: string;
  identityFile: string;
  pluginsDir: string;
}

export function workspaceLayout(root: string): WorkspaceLayout {
  const loomDir = path.join(root, ".loom");
  return {
    root,
    loomDir,
    configFile: path.join(loomDir, "config.json"),
    sessionsDir: path.join(loomDir, "sessions"),
    memoryFile: path.join(loomDir, "memory.json"),
    identityFile: path.join(loomDir, "IDENTITY.md"),
    pluginsDir: path.join(loomDir, "plugins"),
  };
}

export async function initWorkspace(root: string): Promise<WorkspaceLayout> {
  const layout = workspaceLayout(root);
  try {
    await fs.mkdir(layout.loomDir, { recursive: true });
    await fs.mkdir(layout.sessionsDir, { recursive: true });
    await fs.mkdir(layout.pluginsDir, { recursive: true });
  } catch (e: any) {
    console.error(`Warning: Failed to create workspace directories: ${e.message}`);
  }

  try {
    if (!fsSync.existsSync(layout.identityFile)) {
      await fs.writeFile(layout.identityFile, defaultIdentity(root), "utf8");
    }
    if (!fsSync.existsSync(layout.memoryFile)) {
      await fs.writeFile(
        layout.memoryFile,
        JSON.stringify({ notes: [], summaries: [] }, null, 2),
        "utf8"
      );
    }
  } catch (e: any) {
    console.error(`Warning: Failed to write workspace files: ${e.message}`);
  }
  return layout;
}

export async function readWorkspaceContext(root: string): Promise<string> {
  const layout = workspaceLayout(root);
  const parts: string[] = [];

  if (fsSync.existsSync(layout.identityFile)) {
    try {
      parts.push(
        `### IDENTITY\n${await fs.readFile(layout.identityFile, "utf8")}`
      );
    } catch {
      // ignore unreadable identity file
    }
  }
  if (fsSync.existsSync(layout.memoryFile)) {
    try {
      const mem = JSON.parse(await fs.readFile(layout.memoryFile, "utf8"));
      if (mem.notes?.length)
        parts.push(
          `### MEMORY\n${(mem.notes as string[]).slice(-10).join("\n- ")}`
        );
      if (mem.summaries?.length)
        parts.push(
          `### RECENT SUMMARIES\n${(mem.summaries as string[])
            .slice(-3)
            .join("\n\n")}`
        );
    } catch {
      // ignore corrupt memory file
    }
  }

  // Provide README as context
  const readme = path.join(root, "README.md");
  if (fsSync.existsSync(readme)) {
    try {
      const txt = await fs.readFile(readme, "utf8");
      parts.push(`### README (truncated)\n${txt.slice(0, 1500)}`);
    } catch {
      // ignore unreadable README
    }
  }

  return parts.join("\n\n");
}

function defaultIdentity(root: string): string {
  return `# Workspace Identity

**Project root:** ${path.basename(root)}

## Description
Add a short description of this project here. Loom will read this file as workspace context.

## Conventions
- Coding style notes
- Preferred tools or commands

## Out of bounds
- Files or directories Loom should not modify
`;
}
