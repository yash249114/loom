import fs from "node:fs";
import path from "node:path";
import type { Observation, KnowledgeQuery, KnowledgeEntry } from "./types.js";
import { newId } from "../core/util.js";

const MEMORY_DIR = ".loom/memory";

interface StoredMemory {
  observations: Observation[];
  tags: Record<string, string[]>; // tag → observation IDs
}

export class LongTermMemory {
  private rootDir: string;
  private memoryDir: string;
  private data: StoredMemory;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.memoryDir = path.join(rootDir, MEMORY_DIR);
    this.data = { observations: [], tags: {} };
  }

  /* ── Lifecycle ─────────────────────────────────────────────── */

  async load(): Promise<void> {
    const obsPath = path.join(this.memoryDir, "observations.json");
    if (fs.existsSync(obsPath)) {
      try {
        const raw = fs.readFileSync(obsPath, "utf-8");
        this.data = JSON.parse(raw);
      } catch {
        this.data = { observations: [], tags: {} };
      }
    }
  }

  async save(): Promise<void> {
    fs.mkdirSync(this.memoryDir, { recursive: true });
    fs.writeFileSync(
      path.join(this.memoryDir, "observations.json"),
      JSON.stringify(this.data, null, 2),
      "utf-8"
    );
  }

  /* ── CRUD ──────────────────────────────────────────────────── */

  async persist(observations: Observation[]): Promise<void> {
    for (const obs of observations) {
      const dup = this.findDuplicate(obs);
      if (dup) {
        dup.confidence = Math.max(dup.confidence, obs.confidence);
        dup.importance = Math.max(dup.importance, obs.importance);
        dup.timestamp = Math.max(dup.timestamp, obs.timestamp);
        const fileSet = new Set([...dup.files, ...obs.files]);
        dup.files = Array.from(fileSet);
        const symSet = new Set([...dup.symbols, ...obs.symbols]);
        dup.symbols = Array.from(symSet);
        const tagSet = new Set([...dup.tags, ...(obs.tags || [])]);
        dup.tags = Array.from(tagSet);
        continue;
      }
      const entry: Observation = {
        ...obs,
        id: obs.id || newId("obs_"),
        tags: obs.tags || [],
        timestamp: obs.timestamp || Date.now(),
      };
      this.data.observations.push(entry);
      for (const tag of entry.tags) {
        if (!this.data.tags[tag]) this.data.tags[tag] = [];
        this.data.tags[tag].push(entry.id);
      }
    }
    this.prune();
    await this.save();
  }

  async query(query: KnowledgeQuery): Promise<KnowledgeEntry[]> {
    let results = this.data.observations;

    if (query.text) {
      const q = query.text.toLowerCase();
      const tokens = q.split(/\s+/).filter(t => t.length > 2);
      results = results.filter(obs => {
        const text = obs.content.toLowerCase();
        return tokens.some(t => text.includes(t));
      });
    }

    if (query.types && query.types.length > 0) {
      results = results.filter(obs => query.types!.includes(obs.type));
    }

    if (query.files && query.files.length > 0) {
      results = results.filter(obs =>
        obs.files.some(f => query.files!.some(qf => f.includes(qf)))
      );
    }

    if (query.symbols && query.symbols.length > 0) {
      results = results.filter(obs =>
        obs.symbols.some(s => query.symbols!.some(qs => s.includes(qs)))
      );
    }

    if (query.minConfidence !== undefined) {
      results = results.filter(obs => obs.confidence >= query.minConfidence!);
    }

    if (query.minImportance !== undefined) {
      results = results.filter(obs => obs.importance >= query.minImportance!);
    }

    results.sort((a, b) => (b.importance * b.confidence) - (a.importance * a.confidence));

    if (query.limit && query.limit > 0) {
      results = results.slice(0, query.limit);
    }

    return results.map(obs => ({
      observation: obs,
      adrs: [],
      patterns: [],
    }));
  }

  async getByTag(tag: string): Promise<Observation[]> {
    const ids = this.data.tags[tag] || [];
    return this.data.observations.filter(o => ids.includes(o.id));
  }

  async getAll(): Promise<Observation[]> {
    return [...this.data.observations];
  }

  async delete(id: string): Promise<void> {
    this.data.observations = this.data.observations.filter(o => o.id !== id);
    for (const tag of Object.keys(this.data.tags)) {
      this.data.tags[tag] = this.data.tags[tag].filter(tid => tid !== id);
    }
    await this.save();
  }

  async clear(): Promise<void> {
    this.data = { observations: [], tags: {} };
    await this.save();
  }

  getStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    for (const obs of this.data.observations) {
      byType[obs.type] = (byType[obs.type] || 0) + 1;
    }
    return { total: this.data.observations.length, byType };
  }

  /* ── Knowledge Extraction ──────────────────────────────────── */

  extractFromConversation(
    messages: Array<{ role: string; content: string }>,
    sessionId: string
  ): Observation[] {
    const observations: Observation[] = [];
    const combined = messages.map(m => `${m.role}: ${m.content}`).join("\n");

    const decisionPatterns = [
      /(?:we|I)\s+(?:decided|chose|selected|picked)\s+(.+?)(?:\.|because|for)/gi,
      /(?:the\s+)?(?:decision|choice)\s+(?:was|is)\s+(?:to\s+)?(.+?)(?:\.|,)/gi,
    ];
    for (const pattern of decisionPatterns) {
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(combined)) !== null) {
        observations.push({
          id: newId("obs_"),
          type: "decision",
          content: m[1].trim(),
          confidence: 0.6,
          importance: 0.7,
          files: this.extractFileRefs(m[0]),
          symbols: [],
          timestamp: Date.now(),
          sessionId,
          tags: ["auto-extracted", "decision"],
        });
      }
    }

    const conventionPatterns = [
      /(?:we|I)\s+(?:prefer|use|follow|name)\s+(.+?)(?:\.|for|in)/gi,
      /(?:convention|pattern|standard)\s+(?:is|:)\s+(.+?)(?:\.|,)/gi,
    ];
    for (const pattern of conventionPatterns) {
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(combined)) !== null) {
        observations.push({
          id: newId("obs_"),
          type: "convention",
          content: m[1].trim(),
          confidence: 0.5,
          importance: 0.5,
          files: this.extractFileRefs(m[0]),
          symbols: [],
          timestamp: Date.now(),
          sessionId,
          tags: ["auto-extracted", "convention"],
        });
      }
    }

    const relationshipPatterns = [
      /(\w+)\s+(?:depends on|uses|imports|extends|implements)\s+(\w+)/gi,
    ];
    for (const pattern of relationshipPatterns) {
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(combined)) !== null) {
        observations.push({
          id: newId("obs_"),
          type: "relationship",
          content: `${m[1]} → ${m[2]}`,
          confidence: 0.4,
          importance: 0.6,
          files: [],
          symbols: [m[1], m[2]],
          timestamp: Date.now(),
          sessionId,
          tags: ["auto-extracted", "relationship"],
        });
      }
    }

    return observations;
  }

  private extractFileRefs(text: string): string[] {
    const refs: string[] = [];
    const filePattern = /(?:src|lib|app|test)\/[^\s,;)]+(?:\.\w+)?/g;
    let m: RegExpExecArray | null;
    while ((m = filePattern.exec(text)) !== null) {
      refs.push(m[0]);
    }
    return refs;
  }

  private findDuplicate(obs: Observation): Observation | null {
    const text = obs.content.toLowerCase().trim();
    for (const existing of this.data.observations) {
      const existingText = existing.content.toLowerCase().trim();
      const distance = levenshtein(text, existingText);
      const maxLen = Math.max(text.length, existingText.length);
      const ratio = maxLen > 0 ? 1 - distance / maxLen : 0;
      if (ratio > 0.8) return existing;
    }
    return null;
  }

  private prune(): void {
    const MAX_OBSERVATIONS = 1000;
    if (this.data.observations.length > MAX_OBSERVATIONS) {
      this.data.observations.sort((a, b) => (b.importance * b.confidence) - (a.importance * a.confidence));
      this.data.observations = this.data.observations.slice(0, MAX_OBSERVATIONS);
    }
  }
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
