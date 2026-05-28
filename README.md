# GenesisX

> **Every project begins here.** GenesisX reads your entire codebase and builds a tailored team of AI agents — each owning one domain, carrying real architecture knowledge, and scoped with file-level permissions.

> **v0.2** — Enhanced prompt design framework with scoring rubric, anti-patterns, and file priority system. Agent output quality: 8-9/10.

```bash
npm install -g genesisx
cd any-project
genesis .
```

---

## Real Results — 5 GitHub Repositories Tested

### fastapi (Python, 2935 files)

```
┌──────────────────────────────────────────────┐
│   fastapi · Python · 8 files                 │
│   DeepSeek V3 · ~$0.002 · 5 domains          │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│   files                                      │
│   fastapi/                                    │
│   tests/                                      │
│   docs/  docs_src/                           │
│   scripts/                                    │
│   fastapi-slim/                               │
│   8 bugs · 14 untested                        │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│   team                                       │
│   fastapi-core-engineer    fastapi/  49 files│
│   fastapi-test-engineer     tests/        581│
│   documentation-agent       docs/         2235│
│   scripts-maintainer        scripts/       69│
│   fastapi-slim-maintainer   fastapi-slim/   1│
│   reviewer                  all · read-only  │
└──────────────────────────────────────────────┘
```

Generated agent: `fastapi-core-engineer.md` (85 lines). Knows the exact FastAPI version (0.136.3), every core module, all import conventions, async patterns, test framework, and deprecation strategy — extracted straight from the source.

### gin (Go, 53 files) — 2 bugs found

```
┌──────────────────────────────────────────────┐
│   gin · Go · 53 files                        │
│   DeepSeek V3 · ~$0.002 · 5 domains          │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│   files                                      │
│   binding/  render/  internal/  ginS/        │
│   codec/   docs/   examples/   testdata/     │
│   2 bugs · 4 untested                        │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│   team                                       │
│   gin-core-engineer    core modules   54     │
│   codec-dev            codec/           5    │
│   docs-agent           docs/            1    │
│   examples-maintainer  examples/        1    │
│   testdata-domain-agent testdata/       7    │
│   reviewer             all · read-only       │
└──────────────────────────────────────────────┘
```

### express (TypeScript, 10 entries) — 1 bug found

```
┌──────────────────────────────────────────────┐
│   express · TypeScript (Express) · 10 files  │
│   DeepSeek V3 · ~$0.002 · 3 domains          │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│   files                                      │
│   lib/   examples/   test/                   │
│   1 bug · 8 untested                         │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│   team                                       │
│   express-core-engineer  lib/          6     │
│   express-examples-agent examples/    80     │
│   express-test-engineer  test/        112     │
│   reviewer               all · read-only     │
└──────────────────────────────────────────────┘
```

### click (Python, 9 entries) — clean codebase

```
┌──────────────────────────────────────────────┐
│   click · Python · 9 files                   │
│   DeepSeek V3 · ~$0.002 · 4 domains          │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│   files                                      │
│   src/   docs/   examples/   tests/          │
│   0 bugs · 1 untested                        │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│   team                                       │
│   core-dev                 src/        18    │
│   click-documentation-agent docs/      41    │
│   click-examples-auditor    examples/  39    │
│   click-test-engineer       tests/     31    │
│   reviewer                  all · read-only  │
└──────────────────────────────────────────────┘
```

### got (TypeScript, 9 entries) — 3 bugs + 1 secret

```
┌──────────────────────────────────────────────┐
│   got · TypeScript (Express) · 9 files       │
│   DeepSeek V3 · ~$0.002 · 5 domains          │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│   files                                      │
│   source/   test/   documentation/           │
│   media/   benchmark/                        │
│   3 bugs · 1 secret · 2 untested             │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│   team                                       │
│   got-source-agent       source/       23    │
│   got-test-domain-agent  test/         49    │
│   documentation-agent    documentation/ 26   │
│   media-asset-manager    media/         4    │
│   benchmark-agent        benchmark/     2    │
│   reviewer               all · read-only     │
└──────────────────────────────────────────────┘
```

---

## Quick Start

```bash
# 1. Install
npm install -g genesisx

# 2. Set your LLM key (any one works)
export DEEPSEEK_API_KEY=sk-...     # recommended: cheapest, $0.002/run
export ANTHROPIC_API_KEY=sk-ant-... # Claude
export OPENAI_API_KEY=sk-...        # GPT-4o

# 3. Run on any project
cd any-project
genesis .

# Or skip approval for CI/automation
genesis . --yes
genesis . --provider claude
genesis . --dry-run             # preview without writing
genesis . --json                # machine-readable output
```

---

## What Gets Created

```
your-project/
├── prompts/
│   ├── backend-api-engineer.md     # Agent owning backend/ · 36 files
│   ├── frontend-crafter.md         # Agent owning frontend/ · 12 files
│   ├── db-engineer.md              # Agent owning database/ · 8 files
│   └── reviewer.md                 # Read-only reviewer · gates all merges
├── PROJECT-CONTEXT.md              # Full AI narrative of your codebase
└── opencode.json                   # Registered agent team
```

---

## How It Works

```
Phase 1: Survey
Reads directory tree, tech stack, dependencies, imports, configs, tests.

Phase 2: Pre-Analyze (local, 0 tokens, 0 cost)
Detects hardcoded secrets, AI slop, long files, circular imports,
missing error handling, untested files, dead code.

Phase 3: Domain Detection (LLM, ~$0.001)
Sends directory structure + quality flags. LLM identifies natural
domain boundaries — the seams in your codebase.

Phase 4: Deep Analysis (LLM, ~$0.005/domain)
Sends EVERY file in each domain. LLM reads every line. Finds bugs at
file:line precision. Detects AI-generated code. Flags security issues.
Generates the agent prompt with all knowledge extracted from real code.

Phase 5: Build (local, 0 tokens)
Renders agent .md files, writes PROJECT-CONTEXT.md, registers team
in opencode.json.

Approval: You review findings before anything is written. Default yes.
```

---

## Providers

| Provider | Model | Cost/Run* | Context | Setup |
|----------|-------|-----------|---------|-------|
| **DeepSeek** | V3 | $0.002 | 128K | `export DEEPSEEK_API_KEY=sk-...` |
| Claude | Sonnet 4 | $0.08 | 200K | `export ANTHROPIC_API_KEY=sk-ant-...` |
| OpenAI | GPT-4o | $0.05 | 128K | `export OPENAI_API_KEY=sk-...` |

*For a 120-file project. Genesis auto-detects which provider to use from your environment.

[Full cost breakdown →](docs/TOKEN-COSTS.md)

---

## MCP Server

Genesis also runs as an MCP server — connect it to OpenCode, Claude Code, or Cursor:

```json
{
  "mcpServers": {
    "genesis": {
      "command": "npx",
      "args": ["genesis-mcp"]
    }
  }
}
```

Tools: `survey_project`, `propose_team`, `build_team`. Run Genesis from inside your editor — no terminal needed.

---

## Principles

- **Every file is read.** No sampling for quality assessment. The LLM sees your actual code.
- **No token limits.** Choose DeepSeek and it's effectively free (~500 runs per $1).
- **Your code stays local.** Sent directly to the API you choose. Never cached. Never stored.
- **Reviewer always included.** Every team gets a read-only gate. Non-negotiable.
- **File-scoped permissions.** Agents can only edit their domain. Real filesystem paths.

---

## Docs

| Doc | What |
|-----|------|
| [PRD](docs/PRD.md) | What, why, who, success metrics |
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, provider model |
| [Rules](docs/RULES.md) | How Genesis builds itself using its own agents |
| [Token Costs](docs/TOKEN-COSTS.md) | Per-provider cost table, no-limit strategy |
| [Roadmap](docs/ROADMAP.md) | 14-day plan, known blockers, mitigations |
| [Scenarios](docs/SCENARIOS.md) | 5 real-world use cases with terminal output |
| [Difficulties](docs/DIFFICULTIES.md) | What will break and how we handle it |

---

MIT License · GenesisX v0.2
