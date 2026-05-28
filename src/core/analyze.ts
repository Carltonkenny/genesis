import type { DomainBoundaries, ProjectSurvey, QualityReport, DomainBoundary } from '../types.js';

export async function detectDomains(
  survey: ProjectSurvey,
  quality: QualityReport,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llm: { chat: (messages: any[], options?: any) => Promise<string> }
): Promise<DomainBoundaries> {
  // Build the structure-only prompt
  const prompt = buildDomainPrompt(survey, quality);

  // Call LLM for domain boundary detection
  const response = await llm.chat(
    [
      {
        role: 'system',
        content: `You are analyzing a codebase's directory structure to identify natural domain boundaries.
Group files by their responsibilities. Output ONLY valid JSON.

Rules:
- Each domain must have at least 3 files
- Domains with <3 files should be merged into the nearest related domain
- Never create more than 7 domains
- Use the import graph to determine which files belong together
- Files that import from each other are in the same domain

Output format:
{
  "domains": [
    { "name": "backend-api", "paths": ["src/api/", "src/models/"], "fileCount": 22 }
  ],
  "merged": [
    { "path": "src/utils/", "into": "backend-api", "reason": "Only 2 files, imported by api/" }
  ]
}`,
      },
      { role: 'user', content: prompt },
    ],
    { jsonMode: true }
  );

  return parseDomainResponse(response, survey);
}

function buildDomainPrompt(survey: ProjectSurvey, quality: QualityReport): string {
  const dirs = survey.directories
    .map((d) => {
      const flags = [
        quality.longFiles.filter((f) => f.path.startsWith(d.path)).length > 0 ? 'LONG_FILE' : null,
        quality.highComplexity.filter((f) => f.path.startsWith(d.path)).length > 0 ? 'HIGH_COMPLEXITY' : null,
        quality.aiSlop.filter((f) => f.path.startsWith(d.path)).length > 0 ? 'AI_SLOP' : null,
        quality.hardcodedSecrets.filter((f) => f.path.startsWith(d.path)).length > 0 ? 'HARDCODED_SECRET' : null,
      ].filter(Boolean);

      return `  ${d.path}/ (${d.fileCount} files)${flags.length > 0 ? ` [${flags.join(', ')}]` : ''}`;
    })
    .join('\n');

  const imports = survey.importGraph
    .slice(0, 50)
    .map((e) => `  ${e.from} → ${e.to}`)
    .join('\n');

  return `PROJECT: ${survey.name}
LANGUAGE: ${survey.language}${survey.framework ? ` (${survey.framework})` : ''}

DIRECTORY STRUCTURE:
${dirs}

IMPORT GRAPH (sample):
${imports}

ENTRY POINTS: ${survey.entryPoints.join(', ')}

Identify the natural domain boundaries in this project. Group directories that belong together.`;
}

function parseDomainResponse(response: string, survey: ProjectSurvey): DomainBoundaries {
  try {
    // Strip markdown code fences if present
    let json = response.trim();
    if (json.startsWith('```')) {
      json = json.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(json);

    return {
      domains: (parsed.domains || []).map((d: Record<string, unknown>) => ({
        name: String(d.name || 'unknown'),
        paths: Array.isArray(d.paths) ? d.paths.map(String) : [],
        fileCount: Number(d.fileCount) || 0,
        flags: Array.isArray(d.flags) ? d.flags.map(String) : [],
      })),
      merged: (parsed.merged || []).map((m: Record<string, unknown>) => ({
        path: String(m.path || ''),
        into: String(m.into || ''),
        reason: String(m.reason || ''),
      })),
    };
  } catch {
    // Fallback: treat top-level directories as domains
    const domains: DomainBoundary[] = survey.directories.slice(0, 7).map((d) => ({
      name: d.path.replace(/[/\\]/g, '-') + '-dev',
      paths: [d.path + '/*'],
      fileCount: d.fileCount,
      flags: [],
    }));

    return { domains, merged: [] };
  }
}
