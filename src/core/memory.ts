import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { DomainAnalysis, QualityReport } from '../types.js';

export interface GenesisState {
  version: string;
  project: string;
  runCount: number;
  lastRun: string;
  domains: Record<string, DomainState>;
  reviewer: ReviewerState;
}

export interface DomainState {
  agent: string;
  fileCount: number;
  bugs: TrackedBug[];
}

export interface TrackedBug {
  id: string;
  file: string;
  line: number | undefined;
  detail: string;
  severity: string;
  firstSeen: number;
  lastSeen: number;
  status: 'STILL_PRESENT' | 'FIXED' | 'NEW';
}

export interface ReviewerState {
  patterns: string[];
}

export async function loadState(dir: string): Promise<GenesisState | null> {
  try {
    const statePath = join(dir, '.genesis', 'state.json');
    const raw = await readFile(statePath, 'utf-8');
    return JSON.parse(raw) as GenesisState;
  } catch {
    return null;
  }
}

export async function saveState(dir: string, state: GenesisState): Promise<void> {
  const stateDir = join(dir, '.genesis');
  await mkdir(stateDir, { recursive: true });
  const statePath = join(stateDir, 'state.json');
  await writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');
}

export function createState(
  project: string,
  analyses: DomainAnalysis[],
  quality: QualityReport,
  existingState: GenesisState | null
): GenesisState {
  const runCount = (existingState?.runCount ?? 0) + 1;
  const domains: Record<string, DomainState> = {};
  let bugCounter = (existingState?.runCount ?? 0) * 100;

  for (const analysis of analyses) {
    const domainKey = analysis.domain.paths.join(', ');
    const existingDomain = existingState?.domains[domainKey];

    const bugs: TrackedBug[] = [];

    // Merge existing bugs — check if they're still in the current analysis
    if (existingDomain) {
      for (const oldBug of existingDomain.bugs) {
        const stillPresent = analysis.qualityReport.bugs.some(
          (b) => b.path === oldBug.file && b.detail === oldBug.detail
        );
        bugs.push({
          ...oldBug,
          lastSeen: stillPresent ? runCount : oldBug.lastSeen,
          status: stillPresent ? 'STILL_PRESENT' as const : 'FIXED' as const,
        });
      }
    }

    // Add new bugs
    for (const bug of analysis.qualityReport.bugs) {
      const alreadyTracked = bugs.some((b) => b.file === bug.path && b.detail === bug.detail);
      if (!alreadyTracked) {
        bugCounter++;
        bugs.push({
          id: `b${bugCounter}`,
          file: bug.path,
          line: bug.line,
          detail: bug.detail,
          severity: bug.severity,
          firstSeen: runCount,
          lastSeen: runCount,
          status: 'NEW',
        });
      }
    }

    domains[domainKey] = {
      agent: analysis.agentName,
      fileCount: analysis.domain.fileCount,
      bugs,
    };
  }

  // Merge reviewer patterns
  const patterns = existingState?.reviewer.patterns ?? [];
  for (const bug of quality.hardcodedSecrets) {
    const pattern = `Hardcoded secret in source code`;
    if (!patterns.includes(pattern)) patterns.push(pattern);
  }
  for (const cycle of quality.circularImports) {
    if (!patterns.includes(cycle.detail)) patterns.push(cycle.detail);
  }

  return {
    version: '0.2.0',
    project,
    runCount,
    lastRun: new Date().toISOString(),
    domains,
    reviewer: { patterns },
  };
}

export function buildPreviousContext(state: GenesisState | null): string {
  if (!state || state.runCount <= 1) return '';

  const patterns = state.reviewer.patterns.length > 0
    ? `\nPreviously known project patterns to check:\n${state.reviewer.patterns.map((p) => `- ${p}`).join('\n')}`
    : '';

  const stillOpen = Object.values(state.domains)
    .flatMap((d) => d.bugs)
    .filter((b) => b.status === 'STILL_PRESENT' || b.status === 'NEW');

  const bugSection = stillOpen.length > 0
    ? `\nPreviously found bugs (verify if still present or FIXED):\n${stillOpen.map((b) => `  [${b.status}] ${b.file}:${b.line} — ${b.detail}`).join('\n')}`
    : '';

  return `\n\nPROJECT MEMORY (run #${state.runCount}):${patterns}${bugSection}\n`;
}
