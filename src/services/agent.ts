import fs from "node:fs";
import path from "node:path";
import { Agent } from "../agent/agent.js";
import { buildDefaultRegistry } from "../tools/index.js";
import { SafetyGate } from "../safety/gate.js";
import { loadConfig } from "../config/loader.js";
import { createProvider } from "../providers/factory.js";
import { generateDiff } from "../core/diff-viewer.js";
import type { Provider, LoomConfig, ProviderKey, DiffLine } from "../core/types.js";

const FILE_MODIFYING_TOOLS = new Set(["writefile", "editfile", "patchfile"]);

export interface AgentEvents {
  onStep: (step: string) => void;
  onStreamDelta: (delta: string) => void;
  onStreamDone: (fullText: string) => void;
  onToolCall: (name: string, args: unknown) => void;
  onToolResult: (name: string, ok: boolean, output: string) => void;
  onDiff: (filePath: string, diff: DiffLine[]) => void;
  onError: (error: Error) => void;
  onDone: (fullText: string) => void;
}

export class AgentService {
  private agent: Agent | null = null;
  private config: LoomConfig;
  private provider: Provider | null = null;
  private events: AgentEvents;
  private cwd: string;

  constructor(cwd: string, events: AgentEvents) {
    this.cwd = cwd;
    this.events = events;
    const { config } = loadConfig(cwd);
    this.config = config;
    this.detectProvider();
  }

  private detectProvider() {
    // Detect available provider from env vars
    const candidates: { key: ProviderKey; envKey: string }[] = [
      { key: "openrouter", envKey: "OPENROUTER_API_KEY" },
      { key: "anthropic", envKey: "ANTHROPIC_API_KEY" },
      { key: "gemini", envKey: "GEMINI_API_KEY" },
      { key: "openai", envKey: "OPENAI_API_KEY" },
      { key: "groq", envKey: "GROQ_API_KEY" },
    ];

    for (const c of candidates) {
      if (process.env[c.envKey]) {
        const ep = this.config.providerEndpoints[c.key];
        if (ep) {
          this.provider = createProvider(c.key, {
            type: c.key === "anthropic" ? "anthropic" : "openai",
            baseURL: ep.baseURL,
            apiKey: ep.apiKey ?? "",
            model: this.config.models?.coding ?? "qwen/qwen3-coder:free",
          });
          this.config.defaultProvider = c.key;
          return;
        }
      }
    }

    // Fallback: Ollama (local)
    const ep = this.config.providerEndpoints.ollama;
    if (ep) {
      this.provider = createProvider("ollama", {
        type: "ollama",
        baseURL: ep.baseURL,
        model: this.config.models?.local ?? "qwen2.5-coder:7b",
      });
      this.config.defaultProvider = "ollama";
    }
  }

  isReady(): boolean {
    return this.provider !== null;
  }

  getProviderName(): string {
    return this.config.defaultProvider;
  }

  getModelName(): string {
    const ep = this.config.providerEndpoints[this.config.defaultProvider];
    return (ep as any)?.model ?? this.config.models?.coding ?? "unknown";
  }

  sendMessage(content: string): void {
    if (!this.provider) {
      this.events.onError(new Error("No provider available"));
      return;
    }

    const registry = buildDefaultRegistry(this.config);
    const safety = new SafetyGate(this.config.safety, async () => true, true);

    this.agent = new Agent({
      provider: this.provider,
      registry,
      safety,
      config: this.config,
      workspaceRoot: this.cwd,
      skipRouting: false,
    });

    // Track file state for diff generation
    const fileStates = new Map<string, string>();

    // Wire agent events
    this.agent.on("turn:start", (turn: number) => {
      this.events.onStep(`Turn ${turn} starting...`);
    });

    this.agent.on("stream:delta", (delta: string) => {
      this.events.onStreamDelta(delta);
    });

    this.agent.on("stream:done", (fullText: string) => {
      this.events.onStreamDone(fullText);
    });

    this.agent.on("tool:call", (call: { name: string; arguments: unknown }) => {
      this.events.onToolCall(call.name, call.arguments);

      // Capture file state before modification
      if (FILE_MODIFYING_TOOLS.has(call.name)) {
        const args = call.arguments as Record<string, unknown>;
        const filePath = (args.path ?? args.filePath ?? args.file) as string | undefined;
        if (filePath) {
          const fullPath = path.resolve(this.cwd, filePath);
          try {
            const content = fs.readFileSync(fullPath, "utf8");
            fileStates.set(fullPath, content);
          } catch {
            // File doesn't exist yet — new file creation
            fileStates.set(fullPath, "");
          }
        }
      }
    });

    this.agent.on("tool:result", (result: { name: string; ok: boolean; output: string }) => {
      this.events.onToolResult(result.name, result.ok, result.output);

      // Generate diff after file modification
      if (FILE_MODIFYING_TOOLS.has(result.name) && result.ok) {
        // Find the most recent tool:call for this tool to get the file path
        // We need to extract it from the output or use a different approach
        // For now, check all tracked files for changes
        for (const [fullPath, oldContent] of fileStates.entries()) {
          try {
            const newContent = fs.readFileSync(fullPath, "utf8");
            if (oldContent !== newContent) {
              const oldLines = oldContent.split("\n");
              const newLines = newContent.split("\n");
              const relPath = path.relative(this.cwd, fullPath);
              const diff = generateDiff(oldLines, newLines, `a/${relPath}`, `b/${relPath}`);
              this.events.onDiff(relPath, diff);
            }
          } catch {
            // File may have been deleted
          }
        }
        fileStates.clear();
      }
    });

    this.agent.on("agent:error", (err: Error) => {
      this.events.onError(err);
    });

    this.agent.on("agent:done", (fullText: string) => {
      this.events.onDone(fullText);
    });

    this.agent.on("log", (msg: string) => {
      // Could log to state if needed
    });

    // Run agent (non-blocking)
    this.agent.run(content).catch((err) => {
      this.events.onError(err);
    });
  }

  abort(): void {
    this.agent?.abort();
  }
}
