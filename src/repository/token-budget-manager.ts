export interface TokenBudgetConfig {
  maxTokens: number;
  buffer: number;
  warningThreshold: number;
}

export interface Budget {
  total: number;
  used: number;
  remaining: number;
  isExhausted: boolean;
  canAdd: (tokens: number) => boolean;
  add: (tokens: number) => boolean;
  reset: () => void;
}

export interface TokenUsage {
  total: number;
  context: number;
  symbols: number;
  dependencies: number;
  compression: number;
  timestamp: number;
}

export interface BudgetStatus {
  totalBudget: number;
  used: number;
  remaining: number;
  isExhausted: boolean;
  warnings: string[];
}

export class TokenBudgetManager {
  private config: TokenBudgetConfig;
  private currentBudget: Budget;
  private usageHistory: TokenUsage[] = [];

  constructor(config: TokenBudgetConfig) {
    this.config = config;
    this.currentBudget = this.createBudget(config.maxTokens);
  }

  createBudget(limit: number): Budget {
    let used = 0;

    return {
      total: limit,
      used: 0,
      remaining: limit,
      isExhausted: false,
      canAdd: (tokens: number) => used + tokens <= limit,
      add: (tokens: number) => {
        if (used + tokens > limit) return false;
        used += tokens;
        return true;
      },
      reset: () => {
        used = 0;
      },
    };
  }

  getBudget(): Budget {
    return this.currentBudget;
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  trackUsage(usage: TokenUsage): void {
    this.usageHistory.push(usage);
    if (this.usageHistory.length > 100) {
      this.usageHistory.shift();
    }
  }

  getTotalUsage(): TokenUsage {
    const total = this.usageHistory.reduce((sum, u) => sum + u.total, 0);
    return {
      total,
      context: this.usageHistory.reduce((sum, u) => sum + u.context, 0),
      symbols: this.usageHistory.reduce((sum, u) => sum + u.symbols, 0),
      dependencies: this.usageHistory.reduce((sum, u) => sum + u.dependencies, 0),
      compression: this.usageHistory.reduce((sum, u) => sum + u.compression, 0),
      timestamp: Date.now(),
    };
  }

  reset(): void {
    this.currentBudget.reset();
    this.usageHistory = [];
  }

  getStatus(): BudgetStatus {
    const warnings: string[] = [];
    if (this.currentBudget.used > this.config.maxTokens * this.config.warningThreshold) {
      warnings.push(`Token usage exceeds ${this.config.warningThreshold * 100}% threshold`);
    }
    return {
      totalBudget: this.currentBudget.total,
      used: this.currentBudget.used,
      remaining: this.currentBudget.remaining,
      isExhausted: this.currentBudget.isExhausted,
      warnings,
    };
  }

  optimizeContext(context: string): string {
    const tokens = this.estimateTokens(context);
    if (tokens <= this.config.maxTokens) {
      return context;
    }

    const targetTokens = this.config.maxTokens - this.config.buffer;
    const ratio = targetTokens / tokens;
    const targetChars = Math.floor(context.length * ratio);
    return context.slice(0, targetChars) + "\n\n[Context truncated to fit token budget]";
  }
}