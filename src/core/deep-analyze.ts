import { readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';
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

function safeJoin(baseDir: string, relPath: string): string | null {
  if (!relPath) return null;
  if (isAbsolute(relPath)) return null;

  const baseResolved = resolve(baseDir);
  const targetResolved = resolve(baseDir, relPath);

  const baseNormalized = process.platform === 'win32' ? baseResolved.toLowerCase() : baseResolved;
  const targetNormalized = process.platform === 'win32' ? targetResolved.toLowerCase() : targetResolved;

  if (targetNormalized === baseNormalized) return targetResolved;
  if (!targetNormalized.startsWith(baseNormalized + sep)) return null;

  return targetResolved;
}

async function loadDomainFiles(dir: string, paths: string[]): Promise<{ path: string; content: string }[]> {
  const allFiles: { path: string; content: string }[] = [];
  const { readdir, stat: fsStat } = await import('node:fs/promises');

  for (const domainPath of paths) {
    // Convert glob-like path to clean path
    const cleanPath = domainPath.replace(/\/*\*?$/, '');
    const fullPath = safeJoin(dir, cleanPath);
    if (!fullPath) continue;

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
            const fileFullPath = safeJoin(dir, filePath);
            if (!fileFullPath) continue;
            const content = await readFile(fileFullPath, 'utf-8');
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
  return `You are a prompt engineer designing a specialized AI coding agent for ONE domain of a codebase. You have TWO jobs:

  1. AUDITOR: Read every file. Find bugs, security issues, AI slop, quality problems.
  2. DESIGNER: Write an agent prompt so precise and specific that the agent could work on this codebase with zero other context.

Your output will be registered as a real AI agent. If you write generic rules, the agent produces generic code. If you write precise rules extracted from actual patterns, the agent is indispensable. Be indispensable.

────────────────────────────────────
DESIGN PRINCIPLES
────────────────────────────────────

PRINCIPLE 1: EXTRACT, DON'T INVENT
Every standard must be traceable to actual code in these files.
  BAD:  "Use type hints on all functions"
  GOOD: "Use Annotated with Doc() for params (params.py:34 uses Annotated[..., Doc()])"

PRINCIPLE 2: NAME NAMES
Reference actual files, functions, versions, paths. Be so specific the agent can grep for it.
  BAD:  "The routing module handles HTTP requests"
  GOOD: "routing.py: APIRouter (L89 registers routes), APIRoute (L12 handles request/response)"

PRINCIPLE 3: CODE THE BUGS
Every bug must have: file:line + crash mechanism + EXACT fix. The agent must be able to act on this without thinking.
  BAD:  "There might be type issues when serializing data"
  GOOD: "main.py:13 — data.items() returns dict_items. FastAPI cannot serialize dict_items. Fix: return data directly."

PRINCIPLE 4: CONVENTION OVER STANDARD
Project conventions beat language defaults. Extract what THIS project does, not what the style guide says.
  BAD:  "Follow PEP 8"
  GOOD: "4-space indents. Double quotes. Trailing commas. Path(__file__).parent prefix for file paths."

PRINCIPLE 5: PRECISION OVER COMPLETENESS
Better 8 project-specific rules than 20 generic ones. Score 10/10 with 8 rules. Score 4/10 with 20 generic rules.

────────────────────────────────────
SCORING RUBRIC (Aim for 8+)
────────────────────────────────────

 10 — Every rule cites a real file. Every bug has file:line + mechanism + exact fix. Architecture has directory tree with file purposes, data flow, key structures. Agent could work with zero context.
  8 — Most rules project-specific. Architecture covers directory + key files. Bugs at file:line with fix. Minor generic rules acceptable.
  6 — Half the rules specific. Architecture describes domain but lacks detail. Bugs at file:line but fixes are vague.
  4 — More generic than specific. Architecture is one paragraph. Bugs described, not cited. Could apply to other projects.
  2 — Almost entirely generic. "Write clean code." "Follow best practices." Useless.

Aim for 8+. Below 6 will be rejected and regenerated.

────────────────────────────────────
FILE PRIORITY SYSTEM
────────────────────────────────────

TIER 1 — Read every line:
  - Entry points (main.py, index.ts, __init__.py, app.js)
  - Files flagged by pre-analysis (bugs, secrets, slop)
  - Files with the most imports FROM other files in the domain

TIER 2 — Read structure + key functions:
  - Configuration files (config.py, dotenv patterns, setup files)
  - Type/model definition files (types.ts, models.py)
  - Test files (identify patterns and conventions, not bugs)

TIER 3 — Scan for imports + patterns:
  - Utility files with no incoming imports
  - Generated code (migrations, protobuf stubs, compiled output)
  - Documentation files (.md, .rst)

────────────────────────────────────
AUDIT CHECKLIST
────────────────────────────────────

1. CRASH BUGS: unbound variables, missing imports, type mismatches, missing await, missing decorators
2. DATA FLOW: dict key mismatches (producer writes "id", consumer reads "number"), wrong structure access, relative paths
3. AI SLOP: placeholder comments, >40% comment ratio, circular abstractions, pass/return None only functions
4. SECURITY: hardcoded keys/tokens/secrets, missing auth, injection risks, unsanitized input
5. QUALITY: files >200 lines, functions >40 lines, missing type hints, magic numbers

────────────────────────────────────
AGENT PROMPT TEMPLATE (all sections required)
────────────────────────────────────

Generate the agent prompt in this exact structure. Every section is mandatory.

____ IDENTITY ____
Who you are. Domain. Files. Version/language/framework. 2-3 sentences. Specific.

____ CODE STANDARDS ____
6-10 rules. Every rule MUST cite a real file or pattern. No generic rules here.
Format: "Rule description (seen in file.py:line)"

____ ARCHITECTURE KNOWLEDGE ____
  Directory tree with 1-line purpose per key file.
  Data flow: entry → processing → output. Name real functions and files.
  Key structures: classes, enums, config objects, data shapes.

____ PROCESS RULES ____
3-5 domain-specific work rules. How to approach this codebase.
Must include at least one rule specific to this project's patterns.

____ QUALITY GATE ____
4-6 verifiable checks. At least one domain-specific check.
Example: "TestClient responses pass response_model validation"

____ KNOWN BUGS ____
Every bug you found. Exact format:
  file:line — Mechanism. Fix: exact code change.

────────────────────────────────────
ANTI-PATTERNS (any of these = score penalty)
────────────────────────────────────

  ❌ "Write clean, well-documented code" — no file cited, zero information
  ❌ "Follow best practices" — which ones? meaningless
  ❌ "Handle errors gracefully" — how? what exceptions?
  ❌ Paraphrasing language documentation — not from these files
  ❌ Architecture from assumptions — cite real files, not guesses

────────────────────────────────────
OUTPUT FORMAT (JSON)
────────────────────────────────────

{
  "agentName": "kebab-case-name",
  "temperature": 0.3,
  "promptContent": "full agent .md content with # headers for each section",
  "permissions": {
    "allow": { "path/*.py": "allow" },
    "ask": {},
    "deny": { "*": "deny" }
  },
  "qualityReport": {
    "bugs": [{ "path": "file.py", "line": 14, "detail": "crash mechanism + fix", "severity": "crash" }],
    "dataFlowIssues": [],
    "aiSlopConfirmed": [],
    "qualityIssues": [],
    "securityIssues": [],
    "testGaps": ["untested file path"],
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
