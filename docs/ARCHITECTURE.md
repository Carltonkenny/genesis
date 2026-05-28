# Architecture: Genesis

## System Design

```
USER ──▶ CLI (main.ts) ──▶ Survey (survey.ts) ──▶ Pre-Analyzer (quality.ts)
                │                    │                      │
                │                    ▼                      ▼
                │           ProjectSurvey.json      QualityReport.json
                │                    │                      │
                │                    └──────────┬───────────┘
                │                               │
                │                    ┌──────────▼──────────┐
                │                    │  PHASE A LLM CALL    │
                │                    │  (analyze.ts)        │
                │                    │  Structure only      │
                │                    │  Output: domains[]   │
                │                    └──────────┬──────────┘
                │                               │
                │        For each domain:        │
                │                    ┌──────────▼──────────┐
                │                    │  WEIGHTED SAMPLING   │
                │                    │  (sampling.ts)       │
                │                    │  Rank files by       │
                │                    │  import × bug ×      │
                │                    │  boundary proximity  │
                │                    └──────────┬──────────┘
                │                               │
                │                    ┌──────────▼──────────┐
                │                    │  PHASE B LLM CALL    │
                │                    │  (deep-analyze.ts)   │
                │                    │  ALL files in domain │
                │                    │  Output: agent.md    │
                │                    │  + quality notes     │
                │                    └──────────┬──────────┘
                │                               │
                │                    ┌──────────▼──────────┐
                │                    │  VALIDATION           │
                │                    │  (validate.ts)        │
                │                    │  Score agent 0-10     │
                │                    │  Warn if < 6          │
                │                    └──────────┬──────────┘
                │                               │
                │                    ┌──────────▼──────────┐
                │                    │  PHASE C: BUILD      │
                │                    │  (local, 0 tokens)   │
                │                    │                      │
                │                    │  generate.ts: agent  │
                │                    │  .md files           │
                │                    │  register.ts:        │
                │                    │  opencode.json       │
                │                    │  memory.ts: writes   │
                │                    │  .genesis/state.json │
                │                    └──────────┬──────────┘
                │                               │
                ◀───────────────  Team built ───┘
```

## Data Flow

### Phase A: Survey (No LLM)

```
survey.ts reads filesystem →
  Detect language (package.json → Node, requirements.txt → Python, go.mod → Go)
  Detect framework (FastAPI, Express, Next.js, Gin, Rocket)
  Map directory tree with file counts per directory
  Build import graph (parse import/require statements)
  List dependencies (top-level from package.json / requirements.txt / go.mod)
  Detect config files (.env, docker-compose, CI configs)
  Detect test structure (pytest, jest, vitest, go test)
  Identify entry points (main.py, index.ts, cmd/ folder)

Output: ProjectSurvey (typed JSON object)
```

### Pre-Analyzer (No LLM, 0 Tokens)

```
quality.ts runs locally →
  File size analysis (>200 lines flagged)
  Cyclomatic complexity (regex-based, >10 flagged)
  AI slop detection:
    - Comment-to-code ratio > 40%
    - "TODO: implement" patterns
    - Identical comment blocks repeated across files
    - Function bodies that are only pass/return/raise NotImplementedError
  Hardcoded secrets (regex: api_key, password, secret, token, sk-, Bearer)
  Circular imports (graph cycle detection)
  Missing error handling (try/catch absent around HTTP, DB, subprocess calls)
  Untested files (files not referenced in any test file)
  Dead imports (imported but never referenced in file)

Output: QualityReport (per-file flags, annotated)
```

### Phase A LLM (Structure Only, ~5K tokens)

```
analyze.ts formats prompt:

  SYSTEM: You are analyzing a project's codebase. Given this directory tree
  and import graph, identify natural domain boundaries. Group files that
  belong together. Output domain names and file counts.

  PROJECT STRUCTURE:
  src/
    api/ (14 files, imports from models/, services/)
    models/ (8 files, no external imports)
    services/ (12 files, imports from models/, utils/)
    utils/ (5 files, no imports)
    frontend/ (22 files, imports from components/, hooks/)

  IMPORT GRAPH:
  api → models, services
  services → models, utils
  frontend → components, hooks

  QUALITY FLAGS:
  api/main.py: 847 lines, 3 hardcoded secrets, 0 tests
  services/payment.py: circular import with models/
  frontend/App.tsx: 40% comment ratio (possible AI slop)

  Output format:
  {
    domains: [{ name, paths, fileCount, flags }],
    merged: [{ path, into, reason }]
  }

Output: DomainBoundaries (typed JSON, parsed from LLM response)
```

### Phase B LLM (Per-Domain, ALL Files, ~15K tokens per domain)

```
deep-analyze.ts sends one call per domain:

  SYSTEM: You are analyzing ONE domain of a project. You will receive
  EVERY file in this domain. Read every line.

  For each file, identify:
  1. BUGS: Will it crash at runtime? Wrong keys, missing imports, type errors
  2. DATA FLOW: Wrong dict shapes, key mismatches, data silently lost
  3. AI SLOP: Placeholder code, filler comments, dead abstractions
  4. QUALITY: Too long, too complex, inconsistent patterns
  5. SECURITY: Hardcoded secrets, missing auth, injection risks

  Generate:
  1. The agent .md system prompt for this domain:
     - Identity (who the agent is)
     - Code standards (language-specific, extracted from actual patterns)
     - Architecture knowledge (directory structure, data flow, key structures)
     - Process rules (read before write, edit don't rewrite)
     - Quality gate (what to check before marking done)
     - Known bugs (what you found)
  2. File-level permission boundaries (exact globs)
  3. Quality report for this domain

  DOMAIN: backend/api/
  QUALITY FLAGS: main.py has 3 hardcoded secrets, routes.py missing @app.get
  FILES: [all 14 files, contents inline]

Output: DomainAnalysis (typed JSON, parsed from LLM response)
```

### Phase C: Build (Local, 0 Tokens)

```
generate.ts: For each domain analysis, renders dev-agent.hbs template →
  writes ./prompts/{domain-name}.md
  Writes ./prompts/reviewer.md (always)

register.ts: Creates or merges opencode.json with agent entries:
  - model, temperature, tools, permissions, prompt path per agent
  - default_agent: orchestrator (if 5+ agents) or primary dev agent

context.ts: Renders project-context.hbs → writes ./PROJECT-CONTEXT.md
  Full project narrative, architecture overview, conventions, warnings
```

## Key Design Decisions

### Why Handlebars?
Mustache/HBS is logic-less enough to prevent template injection, expressive enough for conditional language-specific blocks (Python indentation vs JS braces). No arbitrary code execution risk.

### Why Regex Tech Detection, Not AST?
AST parsing adds 50MB+ of tree-sitter dependencies and fails on incomplete/broken code. Regex-based detection covers 95% of projects. AST parsing can be added as an optional v2 enhancement.

### Why Max 7 Agents?
Garry Tan principle: small teams win. 7 is the maximum one orchestrator can coordinate. Beyond 7, signal becomes noise. Large projects (9+ domains) get sub-orchestrators in v2.

### Why Full-File Per-Domain (Not Sampling)?
Sampling misses bugs in unseen files. The user's requirement: "The LLM must see every file to judge quality properly." DeepSeek's 128K context makes this affordable.

### Why Pre-Analyzer Before LLM?
Catches 80% of issues locally (0 tokens, 0 cost). Bundles findings into LLM prompts so the LLM focuses on what matters, not on what regex already found.

## Provider Abstraction

```typescript
interface LLMProvider {
  chat(messages: Message[], options?: ChatOptions): Promise<string>;
  static detect(): boolean;
}

// Auto-detection priority:
// 1. DEEPSEEK_API_KEY  → DeepSeek (cheapest, OpenAI-compatible)
// 2. ANTHROPIC_API_KEY → Claude (best analysis quality)
// 3. OPENAI_API_KEY    → GPT-4o (widely available)
// 4. OpenCode config   → OpenCode SDK (uses Copilot subscription)
```
