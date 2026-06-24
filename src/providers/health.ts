import { ProviderKey, ModelInfo } from "../core/types.js";

export interface HealthCheck {
  timestamp: number;
  latencyMs: number;
  ok: boolean;
  error?: string;
  modelCount?: number;
}

export interface ProviderHealth {
  key: ProviderKey;
  checks: HealthCheck[];
  lastCheck: HealthCheck | null;
  avgLatencyMs: number;
  uptimePercent: number;
  consecutiveFailures: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
}

export interface HealthReport {
  providers: Record<ProviderKey, ProviderHealth>;
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  };
  timestamp: number;
}

export interface HealthMonitorOptions {
  maxChecks?: number;
  checkIntervalMs?: number;
  unhealthyThreshold?: number;
}

export class HealthMonitor {
  private health: Map<ProviderKey, ProviderHealth> = new Map();
  private maxChecks: number;
  private checkIntervalMs: number;
  private unhealthyThreshold: number;
  private checkTimers: Map<ProviderKey, NodeJS.Timeout> = new Map();

  constructor(options: HealthMonitorOptions = {}) {
    this.maxChecks = options.maxChecks ?? 50;
    this.checkIntervalMs = options.checkIntervalMs ?? 60_000;
    this.unhealthyThreshold = options.unhealthyThreshold ?? 3;
  }

  recordCheck(key: ProviderKey, check: HealthCheck): void {
    const existing = this.health.get(key) ?? this.createEmptyHealth(key);
    
    existing.checks.push(check);
    if (existing.checks.length > this.maxChecks) {
      existing.checks.shift();
    }

    existing.lastCheck = check;
    existing.avgLatencyMs = this.calculateAvgLatency(existing.checks);
    existing.uptimePercent = this.calculateUptime(existing.checks);

    if (check.ok) {
      existing.consecutiveFailures = 0;
      existing.lastSuccessAt = check.timestamp;
    } else {
      existing.consecutiveFailures++;
      existing.lastFailureAt = check.timestamp;
    }

    this.health.set(key, existing);
  }

  async checkProvider(
    key: ProviderKey,
    checkFn: () => Promise<{ ok: boolean; latencyMs: number; modelCount?: number; error?: string }>
  ): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const result = await checkFn();
      const check: HealthCheck = {
        timestamp: Date.now(),
        latencyMs: result.latencyMs,
        ok: result.ok,
        modelCount: result.modelCount,
        error: result.error,
      };
      this.recordCheck(key, check);
      return check;
    } catch (err: any) {
      const check: HealthCheck = {
        timestamp: Date.now(),
        latencyMs: Date.now() - start,
        ok: false,
        error: err.message ?? String(err),
      };
      this.recordCheck(key, check);
      return check;
    }
  }

  getHealth(key: ProviderKey): ProviderHealth {
    return this.health.get(key) ?? this.createEmptyHealth(key);
  }

  getStatus(key: ProviderKey): "healthy" | "degraded" | "unhealthy" {
    const h = this.health.get(key);
    if (!h || h.checks.length === 0) return "healthy";

    if (h.consecutiveFailures >= this.unhealthyThreshold) return "unhealthy";
    if (h.uptimePercent < 90) return "degraded";
    if (h.avgLatencyMs > 5000) return "degraded";
    return "healthy";
  }

  getReport(): HealthReport {
    const providers: Record<string, ProviderHealth> = {};
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;

    const allKeys: ProviderKey[] = ["openrouter", "gemini", "groq", "openai", "anthropic", "ollama"];
    
    for (const key of allKeys) {
      const h = this.health.get(key) ?? this.createEmptyHealth(key);
      providers[key] = h;
      
      const status = this.getStatus(key);
      if (status === "healthy") healthy++;
      else if (status === "degraded") degraded++;
      else unhealthy++;
    }

    return {
      providers: providers as Record<ProviderKey, ProviderHealth>,
      summary: { healthy, degraded, unhealthy, total: allKeys.length },
      timestamp: Date.now(),
    };
  }

  rankProvidersByHealth(
    availableProviders: ProviderKey[],
    preferredKey?: ProviderKey
  ): ProviderKey[] {
    const scored = availableProviders.map((key) => {
      const status = this.getStatus(key);
      const h = this.health.get(key);
      
      let score = 0;
      if (status === "healthy") score += 100;
      else if (status === "degraded") score += 50;
      else score += 0;

      if (h) {
        score -= h.avgLatencyMs / 100;
        score += h.uptimePercent / 10;
      }

      if (key === preferredKey) score += 50;

      return { key, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.key);
  }

  startPeriodicChecks(
    providers: ProviderKey[],
    checkFn: (key: ProviderKey) => Promise<{ ok: boolean; latencyMs: number; modelCount?: number; error?: string }>
  ): void {
    for (const key of providers) {
      const timer = setInterval(async () => {
        const result = await checkFn(key);
        this.recordCheck(key, {
          timestamp: Date.now(),
          latencyMs: result.latencyMs,
          ok: result.ok,
          modelCount: result.modelCount,
          error: result.error,
        });
      }, this.checkIntervalMs);
      
      this.checkTimers.set(key, timer);
    }
  }

  stopPeriodicChecks(): void {
    for (const timer of this.checkTimers.values()) {
      clearInterval(timer);
    }
    this.checkTimers.clear();
  }

  private createEmptyHealth(key: ProviderKey): ProviderHealth {
    return {
      key,
      checks: [],
      lastCheck: null,
      avgLatencyMs: 0,
      uptimePercent: 100,
      consecutiveFailures: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
    };
  }

  private calculateAvgLatency(checks: HealthCheck[]): number {
    if (checks.length === 0) return 0;
    const sum = checks.reduce((acc, c) => acc + c.latencyMs, 0);
    return Math.round(sum / checks.length);
  }

  private calculateUptime(checks: HealthCheck[]): number {
    if (checks.length === 0) return 100;
    const successful = checks.filter((c) => c.ok).length;
    return Math.round((successful / checks.length) * 100);
  }
}
