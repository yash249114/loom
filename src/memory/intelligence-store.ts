import { RepositoryIntelligence } from "./intelligence-api.js";

let _instance: RepositoryIntelligence | null = null;

export function setIntelligenceInstance(inst: RepositoryIntelligence): void {
  _instance = inst;
}

export function getIntelligenceInstance(): RepositoryIntelligence | null {
  return _instance;
}

export function requireIntelligence(): RepositoryIntelligence {
  if (!_instance) {
    throw new Error(
      "RepositoryIntelligence not initialized. " +
      "Call setIntelligenceInstance() during app startup."
    );
  }
  return _instance;
}
