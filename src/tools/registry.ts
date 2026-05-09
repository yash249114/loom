import type { ToolDefinition, ToolContext } from "../core/types.js";

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  filter(enabled: string[]): ToolRegistry {
    const next = new ToolRegistry();
    for (const name of enabled) {
      const t = this.tools.get(name);
      if (t) next.register(t);
    }
    return next;
  }

  async execute(name: string, args: unknown, ctx: ToolContext): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    const parsed = tool.parameters.parse(args);
    const result = await tool.handler(parsed, ctx);
    return typeof result === "string" ? result : JSON.stringify(result);
  }

  describe(): string {
    return this.list()
      .map((t) => `- ${t.name}: ${t.description}`)
      .join("\n");
  }
}
