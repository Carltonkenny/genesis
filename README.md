# Genesis

> Every project begins here. Genesis reads your codebase and builds a tailored AI engineering team.

```bash
npx genesis .
```

---

## What It Does

Genesis reads EVERY file in your project. It finds bugs, messy code, AI slop, and security issues. Then it generates a team of AI agents — each owning one domain of your codebase, with file-level permissions and deep architecture knowledge extracted from your actual code.

**One command. Your AI engineering team, built.**

---

## Quick Start

```bash
npm install -g genesis
cd any-project
npx genesis .
```

Genesis will:
1. Survey your project (language, framework, modules, tests, configs)
2. Pre-analyze code quality (bugs, secrets, AI slop, complexity)
3. Call an LLM to identify domain boundaries and deeply analyze every file
4. Propose an agent team with reasoning
5. Build the team: `./prompts/*.md`, `PROJECT-CONTEXT.md`, `opencode.json`

---

## Providers

Genesis auto-detects your LLM from environment variables:

```bash
# DeepSeek (recommended — cheapest, highest quality for analysis)
export DEEPSEEK_API_KEY=sk-...

# Claude
export ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
export OPENAI_API_KEY=sk-...
```

Or specify explicitly:

```bash
npx genesis . --provider claude
npx genesis . --provider openai
```

[Full token cost breakdown →](docs/TOKEN-COSTS.md)

---

## What Gets Created

```
your-project/
├── prompts/
│   ├── backend-dev.md        # Agent owning backend/ domain
│   ├── frontend-dev.md       # Agent owning frontend/ domain
│   ├── db-engineer.md        # Agent owning database/ domain
│   └── reviewer.md           # Read-only reviewer gate
├── PROJECT-CONTEXT.md        # Full AI narrative of your project
└── opencode.json             # Registered agent team
```

---

## Commands

```bash
npx genesis .                  # Full pipeline
npx genesis survey .           # Survey only
npx genesis . --yes            # Skip approval
npx genesis . --dry-run        # Show what would be created
npx genesis . --json           # Output as JSON
```

---

## MCP Server

Genesis also works as an MCP server. Register it in your MCP config:

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

Available tools: `survey_project`, `propose_team`, `build_team`.

---

## How It Works (Deep)

### Phase A: Structure Survey
Reads directory tree, tech stack, import graph, dependencies, config files. Pre-analyzer runs locally (0 tokens, 0 cost) to detect bugs, secrets, AI slop, complexity.

### Phase A LLM: Domain Detection
Sends structure only (no file contents) to determine natural domain boundaries. ~$0.001.

### Phase B: Per-Domain Deep Analysis
For EACH domain, sends ALL files to LLM. Reads every line. Finds bugs, data flow issues, AI slop, security problems. Generates agent .md with architecture knowledge. ~$0.005 per domain.

### Phase C: Build (Local)
Renders templates, writes agent files, registers team in opencode.json. 0 tokens. 0 cost.

[Full architecture →](docs/ARCHITECTURE.md)

---

## Cost

At DeepSeek pricing, analyzing a 120-file project costs **$0.02**. A 500-file project costs **$0.04**. Free-tier viable.

[Complete cost table →](docs/TOKEN-COSTS.md)

---

## Engineering Principles

- **Every file is read by the LLM.** No sampling. No shortcuts.
- **No token limits.** Quality first, always.
- **Your code never leaves your machine except to the API you choose.**
- **Guaranteed reviewer.** Every team gets a reviewer gate.
- **File-scoped permissions.** Agents can only edit their own domain.
- **Deterministic.** Same codebase generates the same team.

---

## Docs

- [PRD](docs/PRD.md) — What, why, who, success metrics
- [Architecture](docs/ARCHITECTURE.md) — System design, data flow, decisions
- [Rules](docs/RULES.md) — How Genesis builds itself
- [Token Costs](docs/TOKEN-COSTS.md) — Per-provider cost breakdown
- [Roadmap](docs/ROADMAP.md) — 14-day plan, known blockers
- [Scenarios](docs/SCENARIOS.md) — 5 real-world use cases
- [Difficulties](docs/DIFFICULTIES.md) — What will go wrong and how we handle it

---

## Status

**v0.1.0** — Core engine + CLI shipped. MCP server in progress.

---

MIT License
