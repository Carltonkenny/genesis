# Roadmap

## Week 1: Core Engine + CLI (Ship Day 7)

| Day | Module | Output | Verification |
|-----|--------|--------|-------------|
| 1 | Project scaffold, types, provider interface | `types.ts` complete. All interfaces defined. | `npx tsx src/index.ts` exports types. |
| 2 | `survey.ts` + `quality.ts` | Filesystem traversal. Tech detection. Pre-analyzer flags. | Run on 3 real projects. Structured output correct. |
| 3 | `llm/deepseek.ts`, `llm/claude.ts`, `llm/openai.ts`, `factory.ts` | All 4 providers. Auto-detect from env. | Each provider returns valid JSON from structured prompt. |
| 4 | `analyze.ts` + `deep-analyze.ts` | Phase A domain detection. Phase B per-domain full-file analysis. | Run on all 4 test fixtures. Domain boundaries correct. |
| 5 | `generate.ts` + `register.ts` + `context.ts` | Template rendering. File writing. Registration. | End-to-end on 3 real projects. Files created, JSON valid. |
| 6 | `cli/main.ts` + `cli/ui.ts` | Commander.js. Terminal output with tables, spinner, colors. Approval flow. | `npx genesis .` works. Terminal output looks good. |
| 7 | Integration + npm publish | Test on 5 real projects. README. npm publish v0.1.0. | `npm i -g genesis && cd any-project && genesis .` |

## Week 2: MCP + Hardening (Ship Day 14)

| Day | Module | Output |
|-----|--------|--------|
| 8 | `mcp/server.ts` + `mcp/tools.ts` | 3 MCP tools: survey_project, propose_team, build_team. Stdio transport. |
| 9 | OpenCode integration | Register Genesis MCP in OpenCode config. Run full pipeline from inside OpenCode. |
| 10 | Cross-editor testing | VS Code, Cursor, OpenCode terminals. PowerShell and bash. |
| 11 | Error handling | Large repos (1000+ files). Empty repos. Missing API keys. Network failures. Rate limits. |
| 12 | Docs finalized | PRD, ARCHITECTURE, TOKEN-COSTS, SCENARIOS, README complete. |
| 13 | Community prep | CONTRIBUTING.md. Issue templates. GitHub Actions CI (lint + test + build). |
| 14 | Launch | npm publish v1.0.0. Demo GIF. Launch post. |

## v1.1: Greenfield Support

- `npx genesis new` — scaffolds a new project from a description
- Integrates with kit templates (Next.js, FastAPI, Go API, etc.)
- Generates project structure + agent team from natural language description

## v2: Incremental Updates

- `npx genesis update` — detects changed files, adjusts agent team
- Adds new agents for new domains. Splits agents for domains that grew.
- Preserves reviewer's known bug patterns across updates.

## v3: Agent Performance Tracking

- Tracks which agents produce bugs, which bugs the reviewer catches
- Feeds bug data back into agent prompts (self-improving system)
- Generates project health reports over time

## Potential Blockers & Mitigations

| Blocker | Likelihood | Mitigation |
|---------|-----------|------------|
| DeepSeek API reliability | Medium | OpenAI/Claude fallback works identically. Provider auto-detect fails over gracefully. |
| Large repos exceed context window | Low | DeepSeek supports 1M context via r1 model. Per-domain splitting keeps each call under 128K. |
| LLM returns malformed JSON | Medium | Structured output mode (JSON mode on OpenAI/DeepSeek). Retry with stricter prompt. Parse + validate + retry loop (max 3). |
| Handlebars template edge cases | Low | Templates tested against all 4 fixture projects. Logic kept minimal. |
| npm publish delay | Low | Local `npm link` for testing. Automated publish via GitHub Actions. |
| Cross-platform path issues | Medium | Use `path.posix` for template output. `path.resolve` for local file I/O. Test on Windows + Unix. |
| LLM "hallucinates" file contents | Low | Pre-analyzer runs locally first — catches contradictions. LLM only sees actual file contents we send it. |
| Rate limiting on DeepSeek free tier | Medium | Exponential backoff with jitter. Queue per-domain calls. Fall back to GPT-4o-mini (same cost ballpark). |
