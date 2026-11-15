# Token Budget Engine

**Date:** 2026-06-22  
**Engineer:** Loom Token Management Team  
**Version:** 0.1.0  

---

## Executive Summary

The Token Budget Engine is a critical component of Loom's repository intelligence system. It manages token consumption across the entire agent workflow, ensuring that AI model interactions stay within context window limits while maximizing the value of each token. The engine provides sophisticated token budgeting, compression, and optimization strategies for repositories with 1k to 100k+ files.

**Key Features:**
- **Precise Token Accounting:** Tracks token usage across all operations
- **Dynamic Budgeting:** Adjusts budgets based on repository size and complexity
- **Intelligent Compression:** Applies lossy compression when needed
- **Context Optimization:** Maximizes context value within token limits
- **Performance Monitoring:** Tracks and reports token efficiency

---

## 1. Architecture Overview

### 1.1 Core Components

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Token     │    │   Budget    │    │   Context   │
│   Counter   │───▶│   Manager   │───▶│   Optimizer │
└─────────────┘    └─────────────┘    └─────────────┘
         │                   │                   │
         └─────────────────┼───────────────────┘
                           ▼
                    ┌─────────────┐
                    │   Model     │
                    │   Interface │
                    └─────────────┘
```

### 1.2 Data Flow

1. **Token Counting:** All text generation is tracked for token usage
2. **Budget Management:** Token budgets are allocated and monitored
3. **Context Optimization:** Context is optimized to fit within budgets
4. **Compression:** Context is compressed when needed
5. **Model Interaction:** Optimized context is sent to the model

---

## 2. Token Counting

### 2.1 Token Estimation

Accurate token estimation is crucial for budget management:

```typescript
export interface TokenEstimator {
  // Estimation methods
  estimateText(text: string): number;
  estimateSymbols(symbols: Symbol[]): number;
  estimateDependencies(dependencies: Dependency[]): number;
  estimateContext(context: Context): number;
  
  // Language-specific estimation
  estimateLanguage(text: string, language: Language): number;
  estimateCode(code: string, language: Language): number;
  
  // Model-specific estimation
  estimateForModel(text: string, model: string): number;
}
```

### 2.2 Estimation Algorithms

- **Character-Based:** Simple character count divided by 4
- **Word-Based:** Word count with adjustments for special characters
- **Model-Specific:** Uses model-specific tokenizers (OpenAI, Ollama)
- **Hybrid:** Combines multiple estimation methods for accuracy

### 2.3 Token Counters

```typescript
export class TokenCounter {
  private readonly estimators: Map<string, TokenEstimator>;
  
  // Text counting
  countText(text: string, model?: string): number;
  countSymbols(symbols: Symbol[], model?: string): number;
  countDependencies(dependencies: Dependency[], model?: string): number;
  
  // Context counting
  countContext(context: Context, model?: string): number;
  countRepository(repository: Repository, model?: string): number;
  
  // Budget tracking
  trackTokenUsage(usage: TokenUsage): void;
  getTotalUsage(): TokenUsage;
  reset(): void;
}
```

---

## 3. Budget Management

### 3.1 Budget Types

```typescript
export enum BudgetType {
  CONTEXT_WINDOW = "context_window",
  REQUEST_LIMIT = "request_limit",
  SESSION_LIMIT = "session_limit",
  HOURLY_LIMIT = "hourly_limit",
  DAILY_LIMIT = "daily_limit",
}
```

### 3.2 Budget Classes

```typescript
export interface Budget {
  type: BudgetType;
  limit: number;
  used: number;
  remaining: number;
  
  canAdd(tokens: number): boolean;
  add(tokens: number): boolean;
  reset(): void;
  isExhausted(): boolean;
}

export class ContextBudget implements Budget {
  constructor(limit: number, buffer: number);
  
  // Context window management
  canAddContext(context: Context): boolean;
  addContext(context: Context): boolean;
  
  // Dynamic adjustment
  adjustForComplexity(complexity: number): void;
  adjustForRepositorySize(size: RepositorySize): void;
}

export class SessionBudget implements Budget {
  constructor(limit: number, resetInterval: number);
  
  // Session management
  startSession(): void;
  endSession(): void;
  isNewSession(): boolean;
  
  // Time-based limits
  canAdd(tokens: number, timestamp: number): boolean;
}
```

### 3.3 Budget Strategies

- **Conservative:** Always leave buffer for model response
- **Aggressive:** Use maximum available tokens
- **Adaptive:** Adjust based on model performance
- **Predictive:** Forecast future token needs

```typescript
export enum BudgetStrategy {
  CONSERVATIVE = "conservative",
  AGGRESSIVE = "aggressive",
  ADAPTIVE = "adaptive",
  PREDICTIVE = "predictive",
}
```

---

## 4. Context Optimization

### 4.1 Optimization Techniques

Context optimization ensures maximum value within token limits:

```typescript
export interface ContextOptimizer {
  // Optimization methods
  optimizeContext(context: Context, budget: Budget): OptimizedContext;
  compressContext(context: Context, targetTokens: number): CompressedContext;
  prioritizeContext(context: Context, priority: Priority[]): PrioritizedContext;
  
  // Scoring methods
  scoreRelevance(context: Context, query: string): number;
  scoreCompleteness(context: Context, query: string): number;
  scoreFreshness(context: Context): number;
}
```

### 4.2 Compression Strategies

- **Lossless Compression:** Preserves all information
- **Lossy Compression:** Removes less important information
- **Selective Compression:** Compresses only specific parts
- **Progressive Compression:** Gradually reduces content

```typescript
export interface CompressionStrategy {
  type: CompressionType;
  ratio: number;
  quality: number;
  
  compress(data: any): any;
  decompress(data: any): any;
}

export enum CompressionType {
  LOSSLESS = "lossless",
  LOSSY = "lossy",
  SELECTIVE = "selective",
  PROGRESSIVE = "progressive",
}
```

### 4.3 Prioritization

Context prioritization ensures most important information is preserved:

```typescript
export interface Priority {
  field: string;
  weight: number;
  type: PriorityType;
  
  calculateScore(context: Context): number;
}

export enum PriorityType {
  RELEVANCE = "relevance",
  COMPLETENESS = "completeness",
  FRESHNESS = "freshness",
  IMPORTANCE = "importance",
}
```

---

## 5. Token Budget Manager

### 5.1 Core Functionality

```typescript
export class TokenBudgetManager {
  constructor(config: TokenBudgetConfig);
  
  // Budget management
  createBudget(type: BudgetType, limit: number): Budget;
  allocateBudget(budget: Budget): void;
  releaseBudget(budget: Budget): void;
  
  // Token tracking
  trackUsage(usage: TokenUsage): void;
  getCurrentUsage(): TokenUsage;
  getBudgetStatus(): BudgetStatus;
  
  // Optimization
  optimizeContext(context: Context): OptimizedContext;
  estimateTokenSavings(context: Context): number;
  
  // Configuration
  updateConfig(config: TokenBudgetConfig): void;
  getConfig(): TokenBudgetConfig;
}
```

### 5.2 Configuration

```typescript
export interface TokenBudgetConfig {
  // Default budgets
  defaultContextWindow: number;
  defaultRequestLimit: number;
  defaultSessionLimit: number;
  
  // Buffer settings
  contextBufferRatio: number;
  responseBufferRatio: number;
  
  // Optimization settings
  enableCompression: boolean;
  compressionThreshold: number;
  enablePrioritization: boolean;
  
  // Monitoring
  enableMonitoring: boolean;
  monitoringInterval: number;
  
  // Strategies
  defaultBudgetStrategy: BudgetStrategy;
  adaptiveStrategy: AdaptiveStrategyConfig;
}
```

### 5.3 Adaptive Strategy

Adaptive budgeting adjusts based on repository characteristics:

```typescript
export interface AdaptiveStrategyConfig {
  // Repository size thresholds
  smallRepoThreshold: number;
  mediumRepoThreshold: number;
  largeRepoThreshold: number;
  
  // Budget adjustments
  smallRepoMultiplier: number;
  mediumRepoMultiplier: number;
  largeRepoMultiplier: number;
  
  // Performance thresholds
  performanceThreshold: number;
  adjustmentInterval: number;
}
```

---

## 6. Integration with Loom

### 6.1 Agent Integration

```typescript
export class TokenBudgetEngine {
  constructor(config: TokenBudgetConfig);
  
  // Budget management
  async createSession(): Promise<SessionBudget>;
  async addContext(sessionId: string, context: Context): Promise<boolean>;
  async getSessionStatus(sessionId: string): Promise<BudgetStatus>;
  
  // Optimization
  async optimizeContext(sessionId: string, context: Context): Promise<OptimizedContext>;
  async estimateTokenSavings(sessionId: string, context: Context): Promise<number>;
  
  // Configuration
  updateConfig(config: TokenBudgetConfig): void;
}
```

### 6.2 Workflow Integration

```typescript
// In the agent loop
const tokenBudgetEngine = new TokenBudgetEngine(config);

// Create session for repository
const sessionId = await tokenBudgetEngine.createSession();

// Build context with budget management
const context = await tokenBudgetEngine.buildContext({
  query: "How do I implement authentication?",
  workspace: workspaceRoot,
  maxTokens: config.agent.contextWindow,
  sessionId: sessionId,
  enableOptimization: true
});

// Run agent with token-aware context
const result = await agent.run(userInput, {
  systemPrompt: context.optimized,
  tokenBudget: context.budget,
  // ... other options
});
```

---

## 7. Performance Characteristics

### 7.1 Resource Usage

| Repository Size | Memory Usage | Budget Overhead | Optimization Gain |
|----------------|--------------|----------------|-------------------|
| 1k files | ~50MB | <1MB | 10-20% |
| 5k files | ~200MB | <5MB | 20-30% |
| 10k files | ~400MB | <10MB | 30-40% |
| 100k files | ~2GB | <50MB | 40-50% |

### 7.2 Scaling Considerations

- **Horizontal Scaling:** Multiple workers can manage different budgets
- **Distributed Budgeting:** Centralized budget management for multi-node deployments
- **Caching Layers:** Multiple cache tiers for budget data
- **Incremental Optimization:** Progressive optimization based on usage patterns

---

## 8. Implementation Roadmap

### 8.1 Phase 1 (v0.1.0)
- [ ] Token estimation implementation
- [ ] Basic budget management
- [ ] Simple context optimization
- [ ] Integration with existing Loom config

### 8.2 Phase 2 (v0.2.0)
- [ ] Advanced compression strategies
- [ ] Adaptive budgeting
- [ ] Performance monitoring
- [ ] Multi-model support

### 8.3 Phase 3 (v0.3.0)
- [ ] Distributed budgeting
- [ ] AI-powered optimization
- [ ] Real-time budget adjustment
- [ ] Advanced analytics

---

## 9. Testing

### 9.1 Test Suite

```typescript
// Unit tests
- Token estimation
- Budget management
- Context optimization
- Compression strategies

// Integration tests
- End-to-end budget management
- Large repository handling
- Performance benchmarks
- Memory usage verification

// E2E tests
- Real-world repository budgeting
- Multi-session scenarios
- Concurrent access patterns
```

### 9.2 Benchmarks

Tests run against:
- **Small:** 1k files, 10k LOC
- **Medium:** 5k files, 50k LOC
- **Large:** 10k files, 100k LOC
- **Massive:** 100k files, 1M+ LOC

---

## 10. Future Enhancements

### 10.1 Advanced Features
- **AI-Powered Budgeting:** Use ML to predict optimal budgets
- **Dynamic Compression:** Real-time compression based on model performance
- **Predictive Analytics:** Forecast token needs based on usage patterns
- **Cost Optimization:** Optimize for cost-effectiveness alongside performance

### 10.2 Performance Improvements
- **GPU Acceleration:** Parallel token counting on GPU
- **NVMe Storage:** Faster I/O for large repositories
- **Edge Computing:** Distributed budgeting across nodes
- **Adaptive Algorithms:** Dynamic algorithm selection based on repository size

---

## 11. Conclusion

The Token Budget Engine is a critical component of Loom's repository intelligence system. By efficiently managing token consumption while maximizing context value, it enables Loom to work effectively with repositories of any size while staying within model context window limits.

This engine transforms Loom from a local-first coding assistant into a repository-aware AI agent capable of:
- Understanding complex codebases within token limits
- Providing context-aware suggestions efficiently
- Managing dependencies intelligently within budgets
- Optimizing for large-scale projects with token constraints

The Token Budget Engine is essential for Loom's evolution into a production-grade AI coding assistant that can scale to enterprise-level repositories.