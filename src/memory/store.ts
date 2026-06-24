import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

export interface MemoryDoc {
  notes: string[];
  summaries: string[];
}

export class MemoryStore {
  constructor(private file: string) {}

  async read(): Promise<MemoryDoc> {
    if (!fsSync.existsSync(this.file)) return { notes: [], summaries: [] };
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch {
      return { notes: [], summaries: [] };
    }
  }

  async write(doc: MemoryDoc): Promise<void> {
    try {
      const dir = path.dirname(this.file);
      if (!fsSync.existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
      }
      await fs.writeFile(this.file, JSON.stringify(doc, null, 2), "utf8");
    } catch (e: any) {
      console.error(`Warning: Failed to write memory file: ${e.message}`);
    }
  }

  async addNote(note: string): Promise<void> {
    const doc = await this.read();
    doc.notes.push(note);
    if (doc.notes.length > 200) doc.notes = doc.notes.slice(-200);
    await this.write(doc);
  }

  async addSummary(summary: string): Promise<void> {
    const doc = await this.read();
    doc.summaries.push(summary);
    if (doc.summaries.length > 50) doc.summaries = doc.summaries.slice(-50);
    await this.write(doc);
  }
}
