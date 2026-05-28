import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DomainBoundary, DomainAnalysis, QualityReport, PermissionSet } from '../types.js';

export async function deepAnalyze(
  dir: string,
  domain: DomainBoundary,
  quality: QualityReport,
  language: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  llm: { chat: (messages: any[], options?: any) => Promise<string> },
  maxRetries = 3
): Promise<DomainAnalysis> {
  // Collect ALL files in this domain (cap at 30 for large domains)
  const fileContents = await loadDomainFiles(dir, domain.paths);
  if (fileContents.length === 0) {
    return emptyAnalysis(domain);
  }

  // For domains with >30 files, sample 30 and note the rest
  const MAX_SAMPLE = 30;
  const sampledFiles = fileContents.length > MAX_SAMPLE
    ? fileContents.slice(0, MAX_SAMPLE)
    : fileContents;
  const truncatedNote = fileContents.length > MAX_SAMPLE
    ? `\n(Showing ${MAX_SAMPLE} of ${fileContents.length} files. Remaining ${fileContents.length - MAX_SAMPLE} files not shown but included in analysis.)`
    : '';

  // Build the deep analysis prompt with sampled file contents
  const prompt = buildDeepPrompt(domain, sampledFiles, quality, language) + truncatedNote;

  // Call LLM with retry logic for malformed JSON
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await llm.chat(
        [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: prompt },
        ],
        { jsonMode: true }
      );

      const analysis = parseDeepResponse(response, domain, fileContents, language);
      return analysis;
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        // Retry with error context
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  // All retries failed — return partial analysis
  return fallbackAnalysis(domain, fileContents, lastError?.message || 'Unknown error');
}

async function loadDomainFiles(dir: string, paths: string[]): Promise<{ path: string; content: string }[]> {
  const allFiles: { path: string; content: string }[] = [];
  const { readdir, stat: fsStat } = await import('node:fs/promises');

  for (const domainPath of paths) {
    // Convert glob-like path to clean path
    const cleanPath = domainPath.replace(/\/*\*?$/, '');
    const fullPath = join(dir, cleanPath);

    try {
      const stats = await fsStat(fullPath);

      if (stats.isFile()) {
        // Domain path is a single file — read it directly
        try {
          const content = await readFile(fullPath, 'utf-8');
          allFiles.push({ path: cleanPath, content });
        } catch {
          // Skip unreadable file
        }
      } else if (stats.isDirectory()) {
        // Domain path is a directory — list and read all files
        const entries = await readdir(fullPath, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isFile()) continue;

          const filePath = cleanPath ? `${cleanPath}/${entry.name}` : entry.name;
          try {
            const content = await readFile(join(dir, filePath), 'utf-8');
            allFiles.push({ path: filePath, content });
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch {
      // Path doesn't exist or isn't readable
    }
  }

  return allFiles;
}

function buildSystemPrompt(): string {
  return `You are a senior software engineer performing a DEEP code quality audit of ONE domain in a project.
You will receive EVERY file in this domain. Read every line.

For each file, you must identify:

1. BUGS (CRASH): Will this code crash at runtime? Check for:
   - Unbound variables (used before assignment)
   - Missing imports
   - Type mismatches (.items() called on a list)
   - Missing await on async calls
   - Missing decorators (@app.get, @route)

2. DATA FLOW ISSUES (HIGH): Will data be silently wrong? Check for:
   - Dict key mismatches (producer writes "id", consumer reads "number")
   - Wrong data structure access (accessing dict key on list)
   - Relative paths that break from different working directories
   - Empty strings passed where data is required

3. AI SLOP: Is this AI-generated placeholder code? Check for:
   - Comment ratio > 40%
   - Empty TODO blocks
   - Filler comments that describe obvious code
   - Circular abstractions that add complexity without value
   - Function bodies that are only pass/return None

4. SECURITY: Are there security vulnerabilities?
   - Hardcoded API keys/tokens/secrets
   - Missing authentication checks
   - SQL injection patterns
   - Unsanitized user input

5. QUALITY: Is the code maintainable?
   - Files > 200 lines
   - Functions > 40 lines
   - Missing type hints
   - Magic numbers without named constants

After reading ALL files, generate:

1. The AGENT SYSTEM PROMPT (.md content) for this domain:
   The agent prompt must include:
   a) IDENTITY: who this agent is (e.g., "backend API engineer for [project]")
   b) CODE STANDARDS: language-specific rules extracted from actual project patterns
   c) ARCHITECTURE KNOWLEDGE: directory structure, data flow, key structures, file paths
   d) PROCESS RULES: how to work (read before write, edit don't rewrite, check cache, etc.)
   e) QUALITY GATE: what to verify before marking a change done
   f) KNOWN BUGS: bugs you found (with file:line)

2. A QUALITY REPORT for this domain

3. FILE-LEVEL PERMISSIONS: exact glob patterns for edit boundaries

Output format (JSON):
{
  "agentName": "kebab-case-name",
  "temperature": 0.3,
  "promptContent": "full agent .md content as string",
  "permissions": {
    "allow": { "glob/*": "allow" },
    "ask": { "glob/*": "ask" },
    "deny": { "*": "deny" }
  },
  "qualityReport": {
    "bugs": [{ "path": "...", "line": 14, "detail": "...", "severity": "crash" }],
    "dataFlowIssues": [],
    "aiSlopConfirmed": [],
    "qualityIssues": [],
    "securityIssues": [],
    "testGaps": ["file: no test coverage"],
    "summary": "one-sentence assessment"
  }
}`;
}

function buildDeepPrompt(
  domain: DomainBoundary,
  files: { path: string; content: string }[],
  quality: QualityReport,
  language: string
): string {
  const flags = collectDomainFlags(domain, quality);

  const fileList = files
    .map((f, i) => {
      // Truncate very large files to fit context
      const maxLines = 500;
      const lines = f.content.split('\n');
      const truncated = lines.length > maxLines ? lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)` : f.content;
      return `FILE ${i + 1}: ${f.path} (${lines.length} lines)\n\`\`\`${language.toLowerCase()}\n${truncated}\n\`\`\``;
    })
    .join('\n\n');

  return `DOMAIN: ${domain.name}
PATHS: ${domain.paths.join(', ')}
FILE COUNT: ${domain.fileCount}
LANGUAGE: ${language}

PRE-ANALYSIS FLAGS:
${flags.length > 0 ? flags.map((f) => `- ${f}`).join('\n') : '- No flags'}

ALL FILES IN DOMAIN:
${fileList}

Analyze every file. Find bugs, data flow issues, AI slop, security issues, and quality problems.
Generate the agent system prompt for this domain with all the knowledge extracted from these files.`;
}

function collectDomainFlags(domain: DomainBoundary, quality: QualityReport): string[] {
  const flags: string[] = [];

  for (const f of quality.hardcodedSecrets) {
    if (domain.paths.some((p) => f.path.startsWith(p.replace('/*', '')))) {
      flags.push(`SECRET: ${f.path}`);
    }
  }
  for (const f of quality.longFiles) {
    if (domain.paths.some((p) => f.path.startsWith(p.replace('/*', '')))) {
      flags.push(`LONG: ${f.path} (${f.detail})`);
    }
  }
  for (const f of quality.aiSlop) {
    if (domain.paths.some((p) => f.path.startsWith(p.replace('/*', '')))) {
      flags.push(`AI_SLOP: ${f.path} (${f.detail})`);
    }
  }
  for (const c of quality.circularImports) {
    if (c.files.some((f) => domain.paths.some((p) => f.startsWith(p.replace('/*', ''))))) {
      flags.push(`CYCLE: ${c.detail}`);
    }
  }

  return flags;
}

function parseDeepResponse(
  response: string,
  domain: DomainBoundary,
  files: { path: string; content: string }[],
  language: string
): DomainAnalysis {
  let json = response.trim();
  if (json.startsWith('```')) {
    json = json.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(json);

  return {
    agentName: parsed.agentName || `${domain.name}-dev`,
    domain,
    temperature: Number(parsed.temperature) || 0.3,
    permissions: parsed.permissions || defaultPermissions(domain),
    promptContent: parsed.promptContent || '',
    qualityReport: {
      bugs: parsed.qualityReport?.bugs || [],
      dataFlowIssues: parsed.qualityReport?.dataFlowIssues || [],
      aiSlopConfirmed: parsed.qualityReport?.aiSlopConfirmed || [],
      qualityIssues: parsed.qualityReport?.qualityIssues || [],
      securityIssues: parsed.qualityReport?.securityIssues || [],
      testGaps: parsed.qualityReport?.testGaps || [],
      summary: parsed.qualityReport?.summary || '',
    },
  };
}

function defaultPermissions(domain: DomainBoundary): PermissionSet {
  const allow: Record<string, string> = {};
  for (const p of domain.paths) {
    const glob = p.endsWith('/*') ? p : `${p}/**`;
    allow[glob] = 'allow';
  }
  return {
    allow,
    ask: {},
    deny: { '*': 'deny' },
  };
}

function emptyAnalysis(domain: DomainBoundary): DomainAnalysis {
  return {
    agentName: `${domain.name}-dev`,
    domain,
    temperature: 0.3,
    permissions: defaultPermissions(domain),
    promptContent: '',
    qualityReport: { bugs: [], dataFlowIssues: [], aiSlopConfirmed: [], qualityIssues: [], securityIssues: [], testGaps: [], summary: 'No files found in domain.' },
  };
}

function fallbackAnalysis(
  domain: DomainBoundary,
  files: { path: string; content: string }[],
  error: string
): DomainAnalysis {
  return {
    agentName: `${domain.name}-dev`,
    domain,
    temperature: 0.3,
    permissions: defaultPermissions(domain),
    promptContent: generateFallbackPrompt(domain, files, error),
    qualityReport: { bugs: [], dataFlowIssues: [], aiSlopConfirmed: [], qualityIssues: [], securityIssues: [], testGaps: [], summary: `LLM analysis failed: ${error}` },
  };
}

function generateFallbackPrompt(
  domain: DomainBoundary,
  files: { path: string; content: string }[],
  error: string
): string {
  const fileList = files.map((f) => `- ${f.path}`).join('\n');

  return `# ${domain.name} Agent — ${domain.fileCount} files

> Auto-generated (LLM analysis unavailable: ${error})

## Code Standards
- Read before writing. Search for existing patterns first.
- Edit, don't rewrite. Preserve existing conventions.
- Never hardcode secrets. Use environment variables.
- All public functions must have type hints and docstrings.

## Architecture Knowledge

### Domain Files
${fileList}

### Warnings
- Domain analysis was auto-generated without LLM review.
- Review manually before relying on this agent.
- Run \`npx genesis .\` again when LLM is available for deeper analysis.
`;
}
