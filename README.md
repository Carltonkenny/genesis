# Genesis

> **Every project begins here.** Genesis reads your entire codebase and builds a tailored team of AI agents — each owning one domain, carrying real architecture knowledge, and scoped with file-level permissions.

```bash
npm install -g agent-genesis
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

### gin (Go, 53 files)

Found 2 bugs. Generated 5 agents: `gin-core-engineer`, `codec-dev`, `docs-agent`, `examples-maintainer`, `testdata-domain-agent`.

### express (TypeScript / JavaScript, 10 entries)

Found 1 bug. Generated 3 agents: `express-core-engineer`, `express-examples-agent`, `express-test-engineer`.

### click (Python, 9 entries)

Zero bugs (clean codebase). 4 agents: `core-dev`, `click-documentation-agent`, `click-examples-auditor`, `click-test-engineer`.

### got (TypeScript, 9 entries)

Found 3 bugs and 1 hardcoded secret. 5 agents: `got-source-agent`, `got-test-domain-agent`, `documentation-agent`, `media-asset-manager`, `benchmark-agent`.

---

## Quick Start

```bash
# 1. Install
npm install -g genesis

# 2. Set your LLM key (any one works)
export DEEPSEEK_API_KEY=sk-...     # recommended: cheapest, $0.002/run
export ANTHROPIC_API_KEY=sk-ant-... # Claude
export OPENAI_API_KEY=sk-...        # GPT-4o

# 3. Run on any project
cd any-project
npx genesis .

# Or skip approval for CI/automation
npx genesis . --yes
npx genesis . --provider claude
npx genesis . --dry-run             # preview without writing
npx genesis . --json                # machine-readable output
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

MIT License · Built with Genesis itself
