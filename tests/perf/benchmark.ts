/**
 * Loom Performance Benchmark Harness
 *
 * Generates synthetic repositories of varying sizes and measures:
 * - Indexer: file scanning, parsing, cache write
 * - Retriever: graph build, scoring
 * - Memory: graph load, query
 * - Provider: cache read/write, MCP scoring
 *
 * Usage: tsx tests/perf/benchmark.ts
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const require = createRequire(import.meta.url)
const DIST = path.resolve(__dirname, '../../dist')

// ── Types ────────────────────────────────────────────────────────────

interface BenchmarkResult {
  name: string
  fileCount: number
  latencyMs: number
  cpuMs: number
  memBeforeMB: number
  memAfterMB: number
  memDeltaMB: number
  opsPerSec?: number
}

// ── File Generator ───────────────────────────────────────────────────

function generateSyntheticRepo(dir: string, fileCount: number): void {
  fs.mkdirSync(dir, { recursive: true })

  const languages = ['typescript', 'python', 'go', 'javascript'] as const
  const symbolsPerFile = 8

  for (let i = 0; i < fileCount; i++) {
    const lang = languages[i % languages.length]
    const ext = lang === 'typescript' ? 'ts' : lang === 'python' ? 'py' : lang === 'go' ? 'go' : 'js'
    const subDir = path.join(dir, `module-${Math.floor(i / 100)}`)
    fs.mkdirSync(subDir, { recursive: true })

    const filePath = path.join(subDir, `file_${i}.${ext}`)
    const content = generateFileContent(lang, i, symbolsPerFile, fileCount)
    fs.writeFileSync(filePath, content, 'utf-8')
  }
}

function generateFileContent(
  lang: string,
  index: number,
  symbols: number,
  totalFiles: number
): string {
  const lines: string[] = []

  const importCount = 2 + Math.floor(Math.random() * 4)
  for (let j = 0; j < importCount; j++) {
    const target = Math.floor(Math.random() * totalFiles)
    if (lang === 'typescript' || lang === 'javascript') {
      lines.push(`import { symbol_${target}_${j % symbols} } from './module-${Math.floor(target / 100)}/file_${target}'`)
    } else if (lang === 'python') {
      lines.push(`from module_${Math.floor(target / 100)}.file_${target} import symbol_${target}_${j % symbols}`)
    } else {
      lines.push(`import "module-${Math.floor(target / 100)}/file_${target}"`)
    }
  }

  lines.push('')

  for (let s = 0; s < symbols; s++) {
    if (lang === 'typescript') {
      if (s % 3 === 0) {
        lines.push(`export function symbol_${index}_${s}(input: string): number {`)
        lines.push(`  const result = input.length * ${s + 1}`)
        lines.push(`  return result + ${index}`)
        lines.push('}')
      } else if (s % 3 === 1) {
        lines.push(`export class SymbolClass_${index}_${s} {`)
        lines.push(`  private value: number = ${s}`)
        lines.push(`  process(): string { return \`${s}: \${this.value}\` }`)
        lines.push('}')
      } else {
        lines.push(`export interface ISymbol_${index}_${s} {`)
        lines.push(`  id: number`)
        lines.push(`  name: string`)
        lines.push('}')
      }
    } else if (lang === 'python') {
      if (s % 2 === 0) {
        lines.push(`def symbol_${index}_${s}(input_str: str) -> int:`)
        lines.push(`    result = len(input_str) * ${s + 1}`)
        lines.push(`    return result + ${index}`)
      } else {
        lines.push(`class SymbolClass_${index}_${s}:`)
        lines.push(`    def __init__(self):`)
        lines.push(`        self.value = ${s}`)
        lines.push(`    def process(self) -> str:`)
        lines.push(`        return f"${s}: {self.value}"`)
      }
    } else if (lang === 'go') {
      if (s % 2 === 0) {
        lines.push(`func Symbol_${index}_${s}(input string) int {`)
        lines.push(`\tresult := len(input) * ${s + 1}`)
        lines.push(`\treturn result + ${index}`)
        lines.push('}')
      } else {
        lines.push(`type SymbolStruct_${index}_${s} struct {`)
        lines.push(`\tValue int`)
        lines.push('}')
      }
    } else {
      lines.push(`function symbol_${index}_${s}(input) {`)
      lines.push(`  const result = input.length * ${s + 1}`)
      lines.push(`  return result + ${index}`)
      lines.push('}')
    }
    lines.push('')
  }

  const bodyLines = 20 + Math.floor(Math.random() * 30)
  for (let b = 0; b < bodyLines; b++) {
    lines.push(`// Body line ${b} of file ${index}: ${'x'.repeat(40 + Math.floor(Math.random() * 60))}`)
  }

  return lines.join('\n')
}

function cleanupRepo(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true })
}

// ── Benchmark Helpers ────────────────────────────────────────────────

function memMB(): number {
  return process.memoryUsage().heapUsed / 1024 / 1024
}

function timeIt<T>(fn: () => T): { result: T; ms: number; cpuMs: number } {
  const cpuStart = process.cpuUsage()
  const start = performance.now()
  const result = fn()
  const end = performance.now()
  const cpuEnd = process.cpuUsage(cpuStart)
  return {
    result,
    ms: end - start,
    cpuMs: (cpuEnd.user + cpuEnd.system) / 1000,
  }
}

// ── Benchmarks ───────────────────────────────────────────────────────

function benchmarkIndexer(fileCount: number, repoDir: string): BenchmarkResult {
  const memBefore = memMB()
  const { ms, cpuMs } = timeIt(() => {
    execSync(`node -e "
      const { Indexer } = require('${DIST.replace(/\\/g, '\\\\')}/indexer/indexer.js');
      const i = new Indexer();
      i.run({ rootDir: '${repoDir.replace(/\\/g, '\\\\')}', force: true, outputDir: '${repoDir.replace(/\\/g, '\\\\')}/.loom' }).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) });
    "`, { timeout: 120000, cwd: DIST, stdio: 'pipe' })
  })
  const memAfter = memMB()

  return {
    name: 'Indexer',
    fileCount,
    latencyMs: Math.round(ms),
    cpuMs: Math.round(cpuMs),
    memBeforeMB: Math.round(memBefore * 10) / 10,
    memAfterMB: Math.round(memAfter * 10) / 10,
    memDeltaMB: Math.round((memAfter - memBefore) * 10) / 10,
    opsPerSec: Math.round(fileCount / (ms / 1000)),
  }
}

function benchmarkParser(fileCount: number, repoDir: string): BenchmarkResult {
  const { parseFile } = require(`${DIST}/indexer/parse.js`)

  const files = fs.readdirSync(repoDir, { recursive: true })
    .filter((f: string) => /\.(ts|js|py|go)$/.test(f))
    .slice(0, fileCount)

  const memBefore = memMB()
  let parsed = 0
  const { ms, cpuMs } = timeIt(() => {
    for (const file of files) {
      const fullPath = path.join(repoDir, file as string)
      const content = fs.readFileSync(fullPath, 'utf-8')
      const ext = path.extname(fullPath)
      const lang = ext === '.ts' || ext === '.tsx' ? 'typescript'
        : ext === '.py' ? 'python'
        : ext === '.go' ? 'go'
        : 'javascript'
      parseFile(content, fullPath, lang)
      parsed++
    }
  })
  const memAfter = memMB()

  return {
    name: 'Parser',
    fileCount,
    latencyMs: Math.round(ms),
    cpuMs: Math.round(cpuMs),
    memBeforeMB: Math.round(memBefore * 10) / 10,
    memAfterMB: Math.round(memAfter * 10) / 10,
    memDeltaMB: Math.round((memAfter - memBefore) * 10) / 10,
    opsPerSec: parsed > 0 ? Math.round(parsed / (ms / 1000)) : 0,
  }
}

function benchmarkCache(fileCount: number): BenchmarkResult {
  const { ModelCache } = require(`${DIST}/providers/cache.js`)
  const cacheDir = path.join(os.tmpdir(), `loom-bench-cache-${Date.now()}`)
  fs.mkdirSync(cacheDir, { recursive: true })

  const models = Array.from({ length: Math.min(fileCount, 300) }, (_, i) => ({
    id: `model-${i}`,
    name: `Model ${i}`,
    provider: 'openrouter',
    capabilities: { coding: 0.8, reasoning: 0.7, general: 0.9 },
    contextWindow: 8192,
    mode: 'auto' as const,
  }))

  const cache = new ModelCache(cacheDir, 3600000)

  const memBefore = memMB()
  let ops = 0
  const { ms, cpuMs } = timeIt(() => {
    for (let i = 0; i < 6; i++) {
      cache.write('openrouter' as any, models)
      ops++
    }
    for (let i = 0; i < 100; i++) {
      cache.read('openrouter' as any)
      ops++
    }
  })
  const memAfter = memMB()

  cleanupRepo(cacheDir)

  return {
    name: 'Cache',
    fileCount,
    latencyMs: Math.round(ms),
    cpuMs: Math.round(cpuMs),
    memBeforeMB: Math.round(memBefore * 10) / 10,
    memAfterMB: Math.round(memAfter * 10) / 10,
    memDeltaMB: Math.round((memAfter - memBefore) * 10) / 10,
    opsPerSec: Math.round(ops / (ms / 1000)),
  }
}

function benchmarkMCPScore(fileCount: number): BenchmarkResult {
  const { ModelControlPlane } = require(`${DIST}/providers/mcp.js`)
  const { HealthMonitor } = require(`${DIST}/providers/health.js`)
  const health = new HealthMonitor()
  const mcp = new ModelControlPlane(health)

  const modelCount = Math.min(fileCount, 500)
  const models = Array.from({ length: modelCount }, (_, i) => ({
    id: `model-${i}`,
    name: `Model ${i}`,
    provider: 'openrouter',
    capabilities: { coding: Math.random(), reasoning: Math.random(), general: Math.random() },
    contextWindow: 4096 + Math.floor(Math.random() * 100000),
    mode: (['auto', 'low', 'medium', 'high', 'very-high'] as const)[i % 5],
  }))
  mcp.updateModels('openrouter' as any, models)

  const memBefore = memMB()
  let ops = 0
  const { ms, cpuMs } = timeIt(() => {
    for (let i = 0; i < 100; i++) {
      mcp.selectModel({
        category: 'coding',
        mode: 'auto',
      })
      ops++
    }
  })
  const memAfter = memMB()

  return {
    name: 'MCP Score',
    fileCount,
    latencyMs: Math.round(ms),
    cpuMs: Math.round(cpuMs),
    memBeforeMB: Math.round(memBefore * 10) / 10,
    memAfterMB: Math.round(memAfter * 10) / 10,
    memDeltaMB: Math.round((memAfter - memBefore) * 10) / 10,
    opsPerSec: Math.round(ops / (ms / 1000)),
  }
}

function benchmarkStartup(): BenchmarkResult {
  const memBefore = memMB()
  const { ms, cpuMs } = timeIt(() => {
    execSync('node dist/cli/index.js --version', {
      cwd: path.resolve(__dirname, '../..'),
      timeout: 10000,
      stdio: 'pipe',
    })
  })
  const memAfter = memMB()

  return {
    name: 'Startup',
    fileCount: 0,
    latencyMs: Math.round(ms),
    cpuMs: Math.round(cpuMs),
    memBeforeMB: Math.round(memBefore * 10) / 10,
    memAfterMB: Math.round(memAfter * 10) / 10,
    memDeltaMB: Math.round((memAfter - memBefore) * 10) / 10,
  }
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║       Loom Performance Benchmark Suite          ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log()

  const allResults: BenchmarkResult[] = []
  const sizes = [100, 1000, 5000, 10000]

  // Startup benchmark
  console.log('▸ Measuring startup time...')
  const startup = benchmarkStartup()
  allResults.push(startup)
  console.log(`  Startup: ${startup.latencyMs}ms (CPU: ${startup.cpuMs}ms)`)
  console.log()

  for (const size of sizes) {
    console.log(`━━━ ${size} files ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    const repoDir = path.join(os.tmpdir(), `loom-bench-${size}-${Date.now()}`)
    console.log(`▸ Generating ${size} files...`)
    generateSyntheticRepo(repoDir, size)

    // Parser benchmark
    console.log(`▸ Parsing ${size} files...`)
    const parserResult = benchmarkParser(size, repoDir)
    allResults.push(parserResult)
    console.log(`  Parser:    ${parserResult.latencyMs}ms | CPU: ${parserResult.cpuMs}ms | Mem: ${parserResult.memDeltaMB}MB | ${parserResult.opsPerSec} files/sec`)

    // Indexer benchmark
    console.log(`▸ Indexing ${size} files...`)
    const indexerResult = benchmarkIndexer(size, repoDir)
    allResults.push(indexerResult)
    console.log(`  Indexer:   ${indexerResult.latencyMs}ms | CPU: ${indexerResult.cpuMs}ms | Mem: ${indexerResult.memDeltaMB}MB | ${indexerResult.opsPerSec} files/sec`)

    // Cache benchmark
    console.log(`▸ Cache read/write...`)
    const cacheResult = benchmarkCache(size)
    allResults.push(cacheResult)
    console.log(`  Cache:     ${cacheResult.latencyMs}ms | CPU: ${cacheResult.cpuMs}ms | Mem: ${cacheResult.memDeltaMB}MB | ${cacheResult.opsPerSec} ops/sec`)

    // MCP scoring benchmark
    console.log(`▸ MCP scoring...`)
    const mcpResult = benchmarkMCPScore(size)
    allResults.push(mcpResult)
    console.log(`  MCP:       ${mcpResult.latencyMs}ms | CPU: ${mcpResult.cpuMs}ms | Mem: ${mcpResult.memDeltaMB}MB | ${mcpResult.opsPerSec} ops/sec`)

    console.log()
    cleanupRepo(repoDir)
  }

  // Write results to JSON
  const outputPath = path.join(__dirname, 'results.json')
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2))
  console.log(`Results written to ${outputPath}`)

  // Print summary table
  console.log()
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗')
  console.log('║ BENCHMARK SUMMARY                                                           ║')
  console.log('╠══════════════╦═══════╦══════════╦══════════╦══════════╦════════════════════╣')
  console.log('║ Test         ║ Files ║ Latency  ║ CPU      ║ Mem Δ    ║ Throughput         ║')
  console.log('╠══════════════╬═══════╬══════════╬══════════╬══════════╬════════════════════╣')
  for (const r of allResults) {
    const name = r.name.padEnd(12)
    const files = String(r.fileCount).padStart(5)
    const lat = `${r.latencyMs}ms`.padStart(8)
    const cpu = `${r.cpuMs}ms`.padStart(8)
    const mem = `${r.memDeltaMB}MB`.padStart(8)
    const ops = r.opsPerSec ? `${r.opsPerSec}/sec`.padStart(18) : '—'.padStart(18)
    console.log(`║ ${name} ║ ${files} ║ ${lat} ║ ${cpu} ║ ${mem} ║ ${ops} ║`)
  }
  console.log('╚══════════════╩═══════╩══════════╩══════════╩══════════╩════════════════════╝')
}

main()
