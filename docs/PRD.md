# PRD: Genesis — AI Agent Team Builder

## Problem

Every developer entering a codebase faces the same friction: the AI knows nothing about the project. Context must be rebuilt from scratch. Generic agents produce generic code. There is no repeatable way to create specialized AI agents that understand a specific codebase's architecture, conventions, and known bugs.

## Solution

Genesis reads every file in a project, identifies natural domain boundaries, judges code quality (bugs, messiness, AI slop), and generates a tailored team of AI agents — each owning one domain, carrying project-specific architecture knowledge, and scoped with file-level permissions.

One command: `npx genesis .`

## Users

1. **The Joiner** — Developer joining an existing codebase. No onboarding docs. Genesis maps the project and builds a team that explains it.
2. **The Founder** — Starting a greenfield project. Genesis scaffolds the team from a description of what to build.
3. **The Freelancer** — Managing 5 client projects. Genesis builds a team per project so context never bleeds across clients.
4. **The Contributor** — Contributing to open source. Genesis maps a massive codebase into navigable domains with domain-specific agents.
5. **The Platform Engineer** — Managing a monorepo with 9 services. Genesis builds one agent per service with cross-service boundary awareness.

## Core Flow

1. User runs `npx genesis .` in any terminal
2. Phase A: Genesis surveys the directory — language, framework, modules, test structure, configs, dependencies, import graph
3. Pre-analyzer runs locally (0 tokens): detects long files, high complexity, AI slop patterns, hardcoded secrets, circular imports, test gaps
4. Phase A LLM call (structure only, ~5K tokens): determines domain boundaries
5. Phase B LLM calls (one per domain, ALL files): deep quality assessment per domain, reads every line, finds bugs/mess/slop, generates agent .md and quality report
6. User reviews proposed team, approves
7. Phase C (local, 0 tokens): writes agent .md files, PROJECT-CONTEXT.md, registers team in opencode.json
8. Done. The engineering team is ready.

## Success Metrics

| Metric | Target |
|--------|--------|
| Time to team | < 60 seconds for projects under 200 files |
| File boundary accuracy | Agents own correct file paths 100% of the time |
| Bug detection rate | Pre-analyzer + LLM catches 80%+ of visible bugs |
| Cost per run (DeepSeek) | < $0.05 for projects under 500 files |
| Cross-language support | Python, TypeScript, Go, Rust in v1 |
| User approval rate | > 90% accept the proposed team without modification |

## Non-Goals v1

- Agent execution (Genesis generates agents, does not run them)
- Cross-agent communication between generated agents
- Incremental updates (re-run generates a fresh team)
- GitHub/CI integration (v1 is local only)
- Greenfield project scaffolding (v1.1)
- Agent performance tracking over time (v2)

## Tech Stack

- TypeScript, Node.js 20+
- Commander.js (CLI)
- Handlebars (templates)
- MCP SDK (MCP server)
- DeepSeek V3 (primary LLM, OpenAI-compatible API)
- Anthropic SDK, OpenAI SDK (alternative providers)
