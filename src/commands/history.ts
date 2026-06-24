import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Command } from "./types.js";

const MAX_SESSION = 500;
const HISTORY_DIR = path.join(os.homedir(), ".loom");
const HISTORY_FILE = path.join(HISTORY_DIR, "history.json");

interface HistoryEntry {
  input: string;
  timestamp: number;
}

function loadPersistentHistory(): HistoryEntry[] {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const raw = fs.readFileSync(HISTORY_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.slice(-MAX_SESSION) : [];
  } catch {
    return [];
  }
}

function savePersistentHistory(entries: HistoryEntry[]): void {
  try {
    if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(entries.slice(-MAX_SESSION)), "utf-8");
  } catch {
    // best effort
  }
}

export class CommandHistory {
  private session: string[] = [];
  private persistent: HistoryEntry[];
  private position = -1;
  private maxSession = MAX_SESSION;

  constructor() {
    this.persistent = loadPersistentHistory();
  }

  push(input: string): void {
    if (!input.trim()) return;
    // Deduplicate
    if (this.session.length > 0 && this.session[this.session.length - 1] === input) return;
    this.session.push(input);
    if (this.session.length > this.maxSession) this.session.shift();
    this.position = -1;
    // Persist
    this.persistent.push({ input, timestamp: Date.now() });
    if (this.persistent.length > this.maxSession) this.persistent.shift();
    savePersistentHistory(this.persistent);
  }

  up(): string | null {
    if (this.session.length === 0) return null;
    if (this.position === -1) {
      this.position = this.session.length - 1;
    } else if (this.position > 0) {
      this.position--;
    }
    return this.session[this.position] ?? null;
  }

  down(): string | null {
    if (this.position === -1) return null;
    if (this.position < this.session.length - 1) {
      this.position++;
      return this.session[this.position];
    }
    this.position = -1;
    return "";
  }

  reset(): void {
    this.position = -1;
  }

  all(): string[] {
    return [...this.session];
  }
}
