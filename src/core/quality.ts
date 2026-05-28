import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { QualityReport, FileFlag, CycleInfo } from '../types.js';

interface FileInfo {
  path: string;
  lines: number;
  content: string;
}

export async function preAnalyze(
  dir: string,
  files: string[],
  importGraph: { from: string; to: string }[]
): Promise<QualityReport> {
  const fileInfos = await loadFileContents(dir, files);

  return {
    longFiles: findLongFiles(fileInfos),
    highComplexity: findHighComplexity(fileInfos),
    aiSlop: detectAISlop(fileInfos),
    hardcodedSecrets: findHardcodedSecrets(fileInfos),
    circularImports: findCircularImports(importGraph),
    missingErrorHandling: findMissingErrorHandling(fileInfos),
    untestedFiles: findUntestedFiles(files),
    deadImports: findDeadImports(fileInfos, importGraph),
  };
}

async function loadFileContents(dir: string, files: string[]): Promise<FileInfo[]> {
  const results: FileInfo[] = [];

  for (const file of files) {
    try {
      const content = await readFile(join(dir, file), 'utf-8');
      const lines = content.split('\n').length;
      results.push({ path: file, lines, content });
    } catch {
      // Skip unreadable files
    }
  }

  return results;
}

// ─── Detectors ───

function findLongFiles(files: FileInfo[], threshold = 200): FileFlag[] {
  return files
    .filter((f) => f.lines > threshold)
    .map((f) => ({
      path: f.path,
      detail: `${f.lines} lines (threshold: ${threshold})`,
      severity: f.lines > 500 ? 'high' : f.lines > 1000 ? 'crash' : 'medium',
    }));
}

function findHighComplexity(files: FileInfo[]): FileFlag[] {
  return files
    .filter((f) => {
      // Simplified cyclomatic complexity: count branching keywords
      const branches = (f.content.match(/\b(if|else|for|while|case|catch|\?|&&|\|\|)\b/g) || []).length;
      return branches > 20;
    })
    .map((f) => {
      const branches = (f.content.match(/\b(if|else|for|while|case|catch|\?|&&|\|\|)\b/g) || []).length;
      return {
        path: f.path,
        detail: `High branching complexity: ${branches} branch points detected`,
        severity: 'medium',
      };
    });
}

function detectAISlop(files: FileInfo[]): FileFlag[] {
  const flags: FileFlag[] = [];

  for (const file of files) {
    const lines = file.content.split('\n');
    const totalLines = lines.length;

    // High comment ratio
    const commentLines = lines.filter(
      (l) => l.trim().startsWith('#') || l.trim().startsWith('//') || l.trim().startsWith('--')
    ).length;
    const commentRatio = totalLines > 0 ? commentLines / totalLines : 0;

    if (commentRatio > 0.4) {
      flags.push({
        path: file.path,
        detail: `Comment ratio: ${(commentRatio * 100).toFixed(0)}%. Possible AI-generated filler.`,
        severity: 'low',
      });
    }

    // Placeholder patterns
    const todoCount = (file.content.match(/\bTODO\b/gim) || []).length;
    if (todoCount > 2) {
      flags.push({
        path: file.path,
        detail: `${todoCount} empty TODO placeholders detected.`,
        severity: 'medium',
      });
    }

    // Pass/raise NotImplementedError bodies in Python
    const passBodies = (file.content.match(/^\s*(?:pass|raise\s+NotImplementedError)\s*$/gm) || []).length;
    if (passBodies > 2) {
      flags.push({
        path: file.path,
        detail: `${passBodies} stub bodies (pass/NotImplementedError). Possible AI placeholder.`,
        severity: 'medium',
      });
    }
  }

  return flags;
}

function findHardcodedSecrets(files: FileInfo[]): FileFlag[] {
  const secretPatterns = [
    /\b(api[_-]?key|apikey|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/gi,
    /\b(sk-[a-zA-Z0-9]{20,})\b/g,
    /\b(AKIA[A-Z0-9]{16})\b/g, // AWS access key
    /\b(ghp_[a-zA-Z0-9]{36})\b/g, // GitHub token
  ];

  const flags: FileFlag[] = [];

  for (const file of files) {
    for (const pattern of secretPatterns) {
      const matches = file.content.match(pattern);
      if (matches) {
        flags.push({
          path: file.path,
          detail: 'Hardcoded secret detected',
          severity: 'crash',
        });
        break; // One flag per file is sufficient
      }
    }
  }

  return flags;
}

function findCircularImports(edges: { from: string; to: string }[]): CycleInfo[] {
  const graph = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (!graph.has(edge.from)) graph.set(edge.from, new Set());
    graph.get(edge.from)!.add(edge.to);
  }

  const cycles: CycleInfo[] = [];
  const visited = new Set<string>();

  for (const [node] of graph) {
    if (visited.has(node)) continue;
    const cycle = detectCycle(node, graph, new Set(), visited);
    if (cycle) {
      cycles.push({
        files: cycle,
        detail: `Circular dependency: ${cycle.join(' → ')} → ${cycle[0]}`,
      });
    }
  }

  return cycles;
}

function detectCycle(
  node: string,
  graph: Map<string, Set<string>>,
  stack: Set<string>,
  visited: Set<string>
): string[] | null {
  if (stack.has(node)) {
    return Array.from(stack);
  }
  if (visited.has(node)) return null;

  stack.add(node);
  visited.add(node);

  const neighbors = graph.get(node);
  if (neighbors) {
    for (const neighbor of neighbors) {
      const result = detectCycle(neighbor, graph, stack, visited);
      if (result) return result;
    }
  }

  stack.delete(node);
  return null;
}

function findMissingErrorHandling(files: FileInfo[]): FileFlag[] {
  const flags: FileFlag[] = [];
  const riskyPatterns = [
    /\b(fetch|axios|requests\.(get|post|put|delete)|httpx\.(get|post)|subprocess\.(run|call|Popen)|os\.system)\b/g,
  ];

  for (const file of files) {
    for (const pattern of riskyPatterns) {
      const matches = file.content.match(pattern);
      if (matches) {
        // Check if wrapped in try/catch
        const hasTryCatch = /\btry\s*\{/.test(file.content) || /\btry\s*:/.test(file.content);
        if (!hasTryCatch) {
          flags.push({
            path: file.path,
            detail: `External call without try/catch: ${matches[0]}`,
            severity: 'high',
          });
          break;
        }
      }
    }
  }

  return flags;
}

function findUntestedFiles(files: string[]): string[] {
  const testPatterns = [/\.test\./, /\.spec\./, /test_/, /_test\./, /__tests__/];
  return files.filter((f) => !testPatterns.some((p) => p.test(f)));
}

function findDeadImports(files: FileInfo[], importGraph: { from: string; to: string }[]): FileFlag[] {
  const flags: FileFlag[] = [];

  for (const file of files) {
    const outgoingEdges = importGraph.filter((e) => e.from === file.path);
    for (const edge of outgoingEdges) {
      // Check if the imported module is actually referenced in the file
      const importName = edge.to.split('/').pop() || edge.to;
      const isReferenced = new RegExp(`\\b${importName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(file.content);
      if (!isReferenced) {
        flags.push({
          path: file.path,
          detail: `Unused import: ${edge.to}`,
          severity: 'low',
        });
      }
    }
  }

  return flags;
}
