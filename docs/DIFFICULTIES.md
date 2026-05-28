# Known Difficulties & Mitigations

> Generated during planning. Updated during development. This document exists so the coding agent knows what WILL go wrong before it does.

## Architecture-Level Difficulties

### 1. LLM Output Parsing (HIGH)

**Problem**: LLMs return malformed JSON, markdown-wrapped JSON, or hallucinated fields even with `response_format: { type: "json_object" }`.

**Mitigation**:
- All LLM calls use JSON mode (OpenAI/DeepSeek) or structured prompts with strong format instructions (Claude)
- Parse → validate with Zod schema → retry on failure (max 3 attempts)
- Each retry includes the parse error in the prompt: "Your previous output failed to parse. Error: X. Fix it."
- Fallback: if all 3 retries fail, return partial results. Don't crash. Flag in output.

### 2. Cross-Platform Path Handling (MEDIUM)

**Problem**: Windows uses `\`, Unix uses `/`. File glob patterns in agent permissions must be Unix-style for OpenCode compatibility. Template output paths must be consistent.

**Mitigation**:
- All internal paths use `path.posix` for template output and JSON configs
- `path.resolve` for local filesystem operations
- File globs in `opencode.json` always use forward slashes
- Test on Windows (development machine) and mock Unix paths in tests

### 3. Large Repo Context Overflow (LOW)

**Problem**: A single domain could have 60K+ lines of code, exceeding DeepSeek's 128K context.

**Mitigation**:
- Pre-analyzer flags domains that would exceed 100K tokens BEFORE sending
- If a domain exceeds 80K tokens, split into sub-domains and run separate Phase B calls
- DeepSeek r1 model supports 1M context as fallback
- This is theoretical for v1 — no project in our target range hits this

### 4. DeepSeek API Flakiness (MEDIUM)

**Problem**: DeepSeek can have intermittent 503s, rate limits, or extended downtime.

**Mitigation**:
- Provider auto-detect falls back gracefully: DeepSeek → GPT-4o-mini → Claude → error
- `--provider` flag lets user override
- Exponential backoff with jitter on retries
- Clear error message: "DeepSeek unavailable. Try --provider openai or --provider claude."

### 5. Import Graph Accuracy (MEDIUM)

**Problem**: Regex-based import detection misses dynamic imports (`import(moduleName)`), aliased imports (`import X as Y`), and Python's `__import__()`.

**Mitigation**:
- Regex covers 95% of static imports (from/import in Python, require/import in JS/TS, import in Go)
- Import graph is used for domain boundary suggestions, not enforcement — LLM can override
- v2 can add tree-sitter AST parsing for precise import graphs

## Implementation-Level Difficulties

### 6. Pre-Analyzer False Positives (LOW)

**Problem**: AI slop detection flags legitimate code (high comment ratio in documentation-heavy files, "TODO: implement" in legitimate planning comments).

**Mitigation**:
- Pre-analyzer flags are WARNINGS, not errors. They annotate files for LLM review.
- LLM gets flagged files with context: "File X has 40% comment ratio. Review and confirm if this is AI slop or intentional."
- False positive rate tracked. Rules adjusted if >10% false positive.

### 7. Handlebars Template Edge Cases (LOW)

**Problem**: Special characters in agent prompts breaching Handlebars syntax. Nested quotes in template variables.

**Mitigation**:
- All template variables are HTML-escaped by Handlebars by default
- Triple-brace `{{{var}}}` for raw content (agent prompts need unescaped markdown)
- Templates tested against all 4 fixture projects before Day 5

### 8. opencode.json Merge Conflicts (MEDIUM)

**Problem**: If the target project already has an opencode.json with agent entries, Genesis must merge, not overwrite.

**Mitigation**:
- `register.ts` reads existing opencode.json first
- New agents added under their keys. Existing keys untouched.
- If an agent with the same name exists, Genesis appends a suffix: `backend-dev-2`
- User warned: "Agent 'backend-dev' already exists. Renamed to 'backend-dev-2'."

### 9. npm Package Name Collision (LOW)

**Problem**: "genesis" may already be taken on npm.

**Mitigation**:
- Check npm registry on Day 1. If taken, use `@scope/genesis` or `genesis-ai`.
- Package.json name finalized before any code references it.

## Process-Level Difficulties

### 10. 14-Day Timeline Compression (HIGH)

**Problem**: Full pipeline (survey + analyze + deep-analyze + generate + register + CLI + MCP) in 14 days is aggressive.

**Mitigation**:
- Day 1-7: Core + CLI. If this slips, MCP moves to v1.1. CLI is the MVP.
- Every day ends with a runnable demo. Never go 48 hours without something working.
- Scope cuts (in order): MCP server → greenfield prompts → token cost docs → demo GIF
- NEVER cut: survey, analyze, deep-analyze, generate. These are the product.

### 11. DeepSeek SDK Documentation Gaps (LOW)

**Problem**: DeepSeek is OpenAI-compatible but has undocumented differences in JSON mode or streaming.

**Mitigation**:
- Use OpenAI SDK with `baseURL: "https://api.deepseek.com/v1"`. If it works with OpenAI, it works with DeepSeek.
- Test on Day 1. If there are issues, Claude is the primary fallback.
