import type { SafetyConfig } from "../core/types.js";

export type ConfirmFn = (msg: string) => Promise<boolean>;

export class SafetyGate {
  constructor(
    private config: SafetyConfig,
    private confirmFn: ConfirmFn,
    private alwaysAllow = false
  ) {}

  setAlwaysAllow(v: boolean) {
    this.alwaysAllow = v;
  }

  async confirmShell(command: string): Promise<boolean> {
    if (this.alwaysAllow) return true;
    if (this.config.sandbox) return true; // shell tool short-circuits anyway
    if (!this.config.requireConfirmForShell) return true;
    return this.confirmFn(`Run shell: ${command}`);
  }

  async confirmWrite(detail: string): Promise<boolean> {
    if (this.alwaysAllow) return true;
    if (!this.config.requireConfirmForWrite) return true;
    return this.confirmFn(detail);
  }

  async confirmGeneric(msg: string): Promise<boolean> {
    if (this.alwaysAllow) return true;
    return this.confirmFn(msg);
  }
}
