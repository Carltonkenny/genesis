# RULES.md — Genesis Development Rules

## How Genesis Builds Itself

Genesis uses its own philosophy to develop itself. The project has 5 agents:

| Agent | Domain | When Used |
|-------|--------|-----------|
| `core-dev` | src/core/* | Survey engine, pre-analyzer, domain analysis, file generation, registration |
| `llm-dev` | src/llm/* | Provider implementations (DeepSeek, Claude, OpenAI), factory, auto-detect |
| `cli-dev` | src/cli/* | Commander.js interface, terminal UI, approval flow |
| `mcp-dev` | src/mcp/* | MCP server, tool definitions, stdio transport |
| `reviewer` | all files | Gate before merge. Read-only. Checks against this RULES.md |

## Code Standards (G-Stack)

### TypeScript Strict
- Strict mode enabled. No `any` types. Use `unknown` and narrow with type guards.
- Every public function has JSDoc with `@param` and `@returns`.
- Prefer `interface` over `type` for object shapes.
- No classes unless state + methods are truly coupled. Prefer functions + interfaces.

### File Standards
- One responsibility per file. Maximum 200 lines per module.
- Imports at top, exports at top, no mixing.
- No default exports. Named exports only (better tree-shaking, easier grep).
- File names: kebab-case for modules, PascalCase for types, camelCase for utilities.

### Error Handling
- All external boundaries (LLM calls, file I/O, HTTP) wrapped in try/catch.
- Errors returned as typed results, never thrown across module boundaries.
- User-facing errors use `cli/ui.ts` for formatted output. Never `console.error` directly.

### Testing
- Unit tests per module (Vitest). Integration tests on fixture projects.
- Fixture projects committed to `tests/fixtures/` — real directory structures.
- LLM calls mocked in unit tests. Integration tests use real API keys.
- Coverage target: 80%+ on `src/core/`, 70%+ on `src/llm/`, 60%+ on `src/cli/`.

## The G-Stack Principle

### Ship Every 2 Days
If a module isn't runnable after 48 hours, scope down. A working `survey.ts` is better than a half-built `deep-analyze.ts`. Ship vertical slices, not horizontal layers.

### Boring Tech Wins
- Commander.js for CLI. Not Ink, not React. Terminal output is chalk + ora.
- Handlebars for templates. No custom DSL. No string concatenation.
- MCP SDK for server. No custom protocol. No WebSocket unless MCP requires it.
- Standard library `fs/promises` for file I/O. No `fs-extra`.

### User Experience First
The CLI output IS the product. Terminal colors, tables, spinner, approval flow — these are not afterthoughts. The user's first interaction determines whether they trust the tool.

### Never Break the User's Project
- Genesis ONLY writes to `./prompts/` and `./opencode.json` in the target directory.
- If `opencode.json` exists, Genesis MERGES its agents into it. Never overwrites.
- If `./prompts/` has existing agent files, Genesis creates new ones with different names. Never overwrites.
- A dry-run flag (`--dry-run`) shows what WOULD be written without writing anything.

## Agent Routing Checklist

Before writing ANY code in Genesis:

| Step | Check |
|------|-------|
| 1 | Am I working in the right domain? (core/llm/cli/mcp) |
| 2 | Did I read the relevant RULES.md section? |
| 3 | Does this change respect the G-Stack principle? |
| 4 | Will existing tests still pass? |
| 5 | Is there a fixture project that tests this behavior? |

## Non-Negotiables

1. **Never cache user code.** Files go disk → API → disk. No intermediary storage.
2. **Never hardcode API keys.** All keys from environment variables.
3. **Never exceed 7 agents** in generated teams. Guardrails enforce this, not LLM judgment.
4. **Always include a reviewer** in generated teams. Non-negotiable.
5. **Always scope file permissions.** Every agent's edit boundary is explicit globs.
6. **Never send secrets to LLM.** Pre-analyzer strips lines matching `SECRET|KEY|TOKEN|PASSWORD` patterns before sending to API.
