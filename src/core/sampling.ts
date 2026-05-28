import type { QualityReport, ImportEdge } from '../types.js';

export function weightedSample(
  files: { path: string; content: string }[],
  importGraph: Pick<ImportEdge, 'from' | 'to'>[],
  quality: QualityReport,
  max: number
): { path: string; content: string }[] {
  const scored: { file: { path: string; content: string }; score: number }[] = [];

  for (const file of files) {
    const incoming = importGraph.filter((e) => e.to.includes(file.path) || file.path.includes(e.to)).length;
    const outgoing = importGraph.filter((e) => e.from.includes(file.path) || file.path.includes(e.from)).length;
    const bugs = [
      ...quality.hardcodedSecrets, ...quality.longFiles, ...quality.highComplexity,
      ...quality.aiSlop, ...quality.missingErrorHandling
    ].filter((f) => f.path === file.path || file.path.includes(f.path)).length;
    const crossDir = importGraph.filter((e) => {
      const fromDir = e.from.split(/[/\\]/)[0];
      const toDir = e.to.split(/[/\\]/)[0];
      return (e.from.includes(file.path) || e.to.includes(file.path)) && fromDir !== toDir;
    }).length;

    const score = (incoming * 3) + (outgoing * 2) + (bugs * 5) + (crossDir * 4);
    scored.push({ file, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map((s) => s.file);
}
