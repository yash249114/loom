import type { RepoFile, Symbol, Dependency, RepositoryGraph, ScoredItem } from "./types.js";

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "can", "could",
  "shall", "should", "may", "might", "must", "to", "of", "in", "for", "on",
  "with", "at", "by", "from", "as", "into", "through", "during", "before",
  "after", "above", "below", "between", "out", "off", "over", "under",
  "again", "further", "then", "once", "here", "there", "when", "where",
  "why", "how", "all", "each", "every", "both", "few", "more", "most",
  "other", "some", "such", "no", "nor", "not", "only", "own", "same",
  "so", "than", "too", "very", "just", "because", "but", "and", "or",
  "if", "while", "that", "this", "these", "those", "it", "its",
  "function", "const", "let", "var", "export", "import", "default",
  "return", "async", "await", "type", "interface", "class", "extends",
  "implements", "new", "this", "super", "typeof", "void", "null",
  "undefined", "true", "false", "string", "number", "boolean",
]);

const EXT_WEIGHT: Record<string, number> = {
  ".ts": 1.2,
  ".tsx": 1.2,
  ".js": 1.0,
  ".jsx": 1.0,
  ".json": 0.6,
  ".md": 0.8,
  ".css": 0.4,
  ".html": 0.3,
  ".yaml": 0.5,
  ".yml": 0.5,
  ".toml": 0.5,
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_$]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function computeTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) || 0) + 1);
  }
  const len = tokens.length || 1;
  for (const [k, v] of tf) {
    tf.set(k, v / len);
  }
  return tf;
}

function computeIDF(documents: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  const N = documents.length;

  for (const doc of documents) {
    const seen = new Set(doc);
    for (const t of seen) {
      df.set(t, (df.get(t) || 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [t, count] of df) {
    idf.set(t, Math.log((N - count + 0.5) / (count + 0.5) + 1) + 1);
  }
  return idf;
}

const idfCache = new Map<string, Map<string, number>>();
const IDF_CACHE_TTL_MS = 60_000;

function getCachedIDF(docKey: string, documents: string[][]): Map<string, number> {
  const cached = idfCache.get(docKey);
  if (cached) return cached;
  const idf = computeIDF(documents);
  idfCache.set(docKey, idf);
  setTimeout(() => idfCache.delete(docKey), IDF_CACHE_TTL_MS);
  return idf;
}

function cosineSimilarity(
  queryVec: Map<string, number>,
  docVec: Map<string, number>
): number {
  let dot = 0;
  let qMag = 0;
  let dMag = 0;

  for (const [k, v] of queryVec) {
    qMag += v * v;
    const dv = docVec.get(k) || 0;
    dot += v * dv;
  }
  for (const [, v] of docVec) {
    dMag += v * v;
  }

  const denom = Math.sqrt(qMag) * Math.sqrt(dMag);
  return denom === 0 ? 0 : dot / denom;
}

function buildDocument(file: RepoFile, includeSymbols: boolean, includeDeps: boolean): string[] {
  const parts: string[] = [];

  const pathParts = file.path.replace(/\\/g, "/").split(/[/._-]/).filter(Boolean);
  parts.push(...pathParts);

  parts.push(...tokenize(file.content.slice(0, 2000)));

  if (includeSymbols) {
    for (const sym of file.symbols) {
      parts.push(...tokenize(sym.name));
      if (sym.doc) parts.push(...tokenize(sym.doc));
    }
  }

  if (includeDeps) {
    for (const dep of file.dependencies) {
      parts.push(...tokenize(dep.target));
    }
  }

  return parts;
}

export function rankFiles(
  query: string,
  files: Map<string, RepoFile>,
  symbols: Map<string, Symbol[]>,
  topK: number,
  includeSymbols = true,
  includeDeps = true
): ScoredItem[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const fileList = [...files.values()];
  const documents = fileList.map((f) => buildDocument(f, includeSymbols, includeDeps));
  const docKey = `${fileList.length}:${fileList[0]?.path ?? ''}:${fileList[fileList.length - 1]?.path ?? ''}`;
  const idf = getCachedIDF(docKey, documents);

  const queryTF = computeTF(queryTokens);
  const queryVec = new Map<string, number>();
  for (const [t, tf] of queryTF) {
    queryVec.set(t, tf * (idf.get(t) || 0));
  }

  if (queryVec.size === 0) return [];

  const scored: ScoredItem[] = [];

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const docTokens = documents[i];
    const docTF = computeTF(docTokens);
    const docVec = new Map<string, number>();
    for (const [t, tf] of docTF) {
      docVec.set(t, tf * (idf.get(t) || 0));
    }

    let score = cosineSimilarity(queryVec, docVec);

    const pathParts = file.path.replace(/\\/g, "/").split("/");
    for (const part of pathParts) {
      const lower = part.toLowerCase();
      const qLower = query.toLowerCase();
      if (lower.includes(qLower)) {
        score += 0.3;
      }
    }

    if (file.language === "typescript") {
      const ext = "." + file.path.split(".").pop() || "";
      score *= EXT_WEIGHT[ext] || 1.0;
    }

    const matchedSymbols = symbols.get(file.path)?.filter((s) => {
      const sn = s.name.toLowerCase();
      return queryTokens.some((qt) => sn.includes(qt) || qt.includes(sn));
    }) || [];

    const matchedDeps = file.dependencies.filter((d) => {
      return queryTokens.some((qt) => d.target.toLowerCase().includes(qt));
    });

    if (matchedSymbols.length > 0) {
      score += 0.1 * Math.min(matchedSymbols.length, 5);
    }

    if (score > 0) {
      scored.push({ file, score, matchedSymbols, matchedDeps });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export { tokenize };
