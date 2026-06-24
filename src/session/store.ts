import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "node:path";
import fs from "node:fs";
import { newId } from "../core/util.js";
import type { Session, Message } from "../core/types.js";

interface DBShape {
  sessions: Session[];
}

export class SessionStore {
  private db: Low<DBShape>;

  constructor(private dir: string) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      // Directory creation may fail on read-only filesystem — store will be read-only
    }
    const file = path.join(dir, "sessions.json");
    this.db = new Low<DBShape>(new JSONFile<DBShape>(file), { sessions: [] });
  }

  async load(): Promise<void> {
    try {
      await this.db.read();
      // lowdb v7: data is already initialized via the second constructor arg
      if (!this.db.data) {
        this.db.data = { sessions: [] };
      }
    } catch (error) {
      // Handle corrupt database file gracefully
      this.db.data = { sessions: [] };
      await this.db.write();
    }
  }

  async list(): Promise<Session[]> {
    await this.load();
    return [...this.db.data.sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string): Promise<Session | null> {
    await this.load();
    return this.db.data.sessions.find((s) => s.id === id) ?? null;
  }

  async create(opts: {
    workspace: string;
    provider: string;
    model: string;
  }): Promise<Session> {
    await this.load();
    const session: Session = {
      id: newId("sess"),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      workspace: opts.workspace,
      provider: opts.provider,
      model: opts.model,
      messages: [],
    };
    this.db.data.sessions.push(session);
    await this.db.write();
    return session;
  }

  async update(
    id: string,
    messages: Message[],
    summary?: string
  ): Promise<void> {
    await this.load();
    const s = this.db.data.sessions.find((x) => x.id === id);
    if (!s) return;
    s.messages = messages.map((m) => ({
      ...m,
      id: (m as any).id ?? newId("msg"),
    }));
    s.updatedAt = Date.now();
    if (summary) s.summary = summary;
    await this.db.write();
  }

  async delete(id: string): Promise<void> {
    await this.load();
    this.db.data.sessions = this.db.data.sessions.filter(
      (s) => s.id !== id
    );
    await this.db.write();
  }
}
