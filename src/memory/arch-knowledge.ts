import fs from "node:fs";
import path from "node:path";
import type { ADR, ArchPattern, PatternResult } from "./types.js";
import { newId } from "../core/util.js";

const ARCH_DIR = ".loom/arch";

export class ArchitectureKnowledge {
  private rootDir: string;
  private archDir: string;
  private adrs: ADR[] = [];
  private patterns: ArchPattern[] = [];

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.archDir = path.join(rootDir, ARCH_DIR);
  }

  /* ── Lifecycle ─────────────────────────────────────────────── */

  async load(): Promise<void> {
    const adrPath = path.join(this.archDir, "adrs.json");
    if (fs.existsSync(adrPath)) {
      try {
        this.adrs = JSON.parse(fs.readFileSync(adrPath, "utf-8"));
      } catch { /* ignore */ }
    }
    const patPath = path.join(this.archDir, "patterns.json");
    if (fs.existsSync(patPath)) {
      try {
        this.patterns = JSON.parse(fs.readFileSync(patPath, "utf-8"));
      } catch { /* ignore */ }
    }
  }

  async save(): Promise<void> {
    fs.mkdirSync(this.archDir, { recursive: true });
    fs.writeFileSync(path.join(this.archDir, "adrs.json"), JSON.stringify(this.adrs, null, 2), "utf-8");
    fs.writeFileSync(path.join(this.archDir, "patterns.json"), JSON.stringify(this.patterns, null, 2), "utf-8");
  }

  /* ── ADR Management ────────────────────────────────────────── */

  getAllADRs(): ADR[] {
    return [...this.adrs];
  }

  getADR(id: string): ADR | undefined {
    return this.adrs.find(a => a.id === id);
  }

  getADRsByStatus(status: ADR["status"]): ADR[] {
    return this.adrs.filter(a => a.status === status);
  }

  getADRsByTag(tag: string): ADR[] {
    return this.adrs.filter(a => a.tags.includes(tag));
  }

  async addADR(adr: Omit<ADR, "id" | "createdAt" | "updatedAt">): Promise<ADR> {
    const entry: ADR = {
      ...adr,
      id: newId("adr_"),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.adrs.push(entry);
    await this.save();
    return entry;
  }

  async updateADRStatus(id: string, status: ADR["status"], reason?: string): Promise<ADR | undefined> {
    const adr = this.adrs.find(a => a.id === id);
    if (!adr) return undefined;
    adr.status = status;
    adr.updatedAt = Date.now();
    if (reason) {
      adr.reasoning = adr.reasoning ? `${adr.reasoning}\n[${new Date().toISOString()}] ${reason}` : reason;
    }
    await this.save();
    return adr;
  }

  async supersedeADR(id: string, supersededBy: string): Promise<void> {
    const adr = this.adrs.find(a => a.id === id);
    if (!adr) return;
    adr.status = "superseded";
    adr.supersededBy = supersededBy;
    adr.updatedAt = Date.now();
    await this.save();
  }

  async deleteADR(id: string): Promise<void> {
    this.adrs = this.adrs.filter(a => a.id !== id);
    await this.save();
  }

  /* ── Architecture Pattern Detection ────────────────────────── */

  getAllPatterns(): ArchPattern[] {
    return [...this.patterns];
  }

  async addPattern(pattern: Omit<ArchPattern, "id" | "firstObserved">): Promise<ArchPattern> {
    const entry: ArchPattern = {
      ...pattern,
      id: newId("pat_"),
      firstObserved: Date.now(),
    };
    this.patterns.push(entry);
    await this.save();
    return entry;
  }

  detectPatterns(files: string[], symbols: string[]): PatternResult[] {
    const results: PatternResult[] = [];
    const fileText = files.join(" ").toLowerCase();
    const symText = symbols.join(" ").toLowerCase();

    const builtIn: Array<{ name: string; description: string; detect: (f: string, s: string) => number }> = [
      {
        name: "Repository Pattern",
        description: "Data access abstracted behind repositories",
        detect: (f, s) => (f.includes("repository") || s.includes("repository")) ? 0.8 : 0,
      },
      {
        name: "Service Layer",
        description: "Business logic encapsulated in service classes",
        detect: (f, s) => (f.includes("service") || s.includes("service")) ? 0.7 : 0,
      },
      {
        name: "Controller Pattern",
        description: "Request handling in dedicated controllers",
        detect: (f, s) => (f.includes("controller") || s.includes("controller")) ? 0.8 : 0,
      },
      {
        name: "Middleware Pipeline",
        description: "Request processing through middleware chain",
        detect: (f, s) => (f.includes("middleware") || s.includes("middleware")) ? 0.7 : 0,
      },
      {
        name: "Event-Driven Architecture",
        description: "Communication via events and handlers",
        detect: (f, s) => {
          const score = (f.match(/event|emitter|listener|publish|subscribe/g) || []).length;
          return Math.min(score * 0.2, 0.9);
        },
      },
      {
        name: "Plugin Architecture",
        description: "Extensible via plugins or extensions",
        detect: (f, s) => (f.includes("plugin") || s.includes("plugin")) ? 0.8 : 0,
      },
      {
        name: "Strategy Pattern",
        description: "Algorithms selected at runtime via strategy objects",
        detect: (f, s) => (f.includes("strategy") || s.includes("strategy")) ? 0.7 : 0,
      },
      {
        name: "Observer Pattern",
        description: "State changes broadcast to observers",
        detect: (f, s) => (f.includes("observer") || s.includes("observer") || f.includes("watcher")) ? 0.7 : 0,
      },
      {
        name: "Factory Pattern",
        description: "Object creation delegated to factories",
        detect: (f, s) => (f.includes("factory") || s.includes("factory") || s.includes("Factory")) ? 0.7 : 0,
      },
      {
        name: "Dependency Injection",
        description: "Dependencies provided externally",
        detect: (f, s) => (f.includes("di-") || f.includes("inject") || s.includes("inject") || f.includes("container")) ? 0.8 : 0,
      },
    ];

    for (const pattern of builtIn) {
      const confidence = pattern.detect(fileText, symText);
      if (confidence > 0.3) {
        results.push({
          pattern: {
            id: newId("pat_"),
            name: pattern.name,
            description: pattern.description,
            category: "module-structure",
            files: files.slice(0, 5),
            confidence,
            firstObserved: Date.now(),
            lastObserved: Date.now(),
            occurrenceCount: 1,
            evidence: { files: files.slice(0, 5), symbols: symbols.slice(0, 5) },
          },
          confidence,
          evidence: [`Matched naming convention for "${pattern.name}"`],
        });
      }
    }

    for (const known of this.patterns) {
      const confidence = known.confidence;
      const evidence: string[] = [];
      for (const kw of known.evidence.files || []) {
        if (fileText.includes(kw.toLowerCase())) evidence.push(`matched file keyword: ${kw}`);
      }
      for (const kw of known.evidence.symbols || []) {
        if (symText.includes(kw.toLowerCase())) evidence.push(`matched symbol keyword: ${kw}`);
      }
      if (evidence.length > 0) {
        results.push({ pattern: known, confidence, evidence });
      }
    }

    return results;
  }

  /* ── Context Assembly ──────────────────────────────────────── */

  async getArchitectureContext(files: string[], symbols: string[]): Promise<string> {
    const parts: string[] = [];

    const active = this.adrs.filter(a => a.status === "accepted" || a.status === "proposed");
    if (active.length > 0) {
      parts.push("## Architecture Decisions\n");
      for (const adr of active.slice(0, 5)) {
        parts.push(`- **${adr.title}** (${adr.status}): ${adr.context}`);
      }
    }

    const detected = this.detectPatterns(files, symbols);
    if (detected.length > 0) {
      parts.push("\n## Detected Patterns\n");
      for (const d of detected.slice(0, 5)) {
        parts.push(`- **${d.pattern.name}** (${(d.confidence * 100).toFixed(0)}%): ${d.pattern.description}`);
      }
    }

    return parts.join("\n");
  }
}
