# Token Costs — Genesis

## Principle: No Limits, Quality First

Genesis sends ALL files in a domain to the LLM. Every line is read. Quality assessment is comprehensive. The user controls cost by choosing the provider.

## Per-Run Cost by Provider

| Provider | Model | Context | Input $/M | Output $/M | ~7K run | ~70K run | ~280K run |
|----------|-------|---------|-----------|------------|---------|----------|-----------|
| **DeepSeek** | V3 | 128K | $0.27 | $0.28 | $0.002 | $0.021 | $0.079 |
| Claude | Sonnet 4 | 200K | $3.00 | $15.00 | $0.082 | $0.50 | $2.20 |
| GPT-4o | GPT-4o | 128K | $2.50 | $10.00 | $0.047 | $0.30 | $1.40 |
| GPT-4o-mini | 4o-mini | 128K | $0.15 | $0.60 | $0.001 | $0.012 | $0.048 |

## Cost Per Project Type (DeepSeek)

| Project Type | Files | Domains | LLM Calls | Est. Tokens | Cost |
|-------------|-------|---------|-----------|-------------|------|
| Single script | 1 | 1 | 2 | 4K | $0.001 |
| Small API | 35 | 2 | 3 | 15K | $0.004 |
| Medium app | 120 | 4 | 5 | 50K | $0.015 |
| Chronicles-level | 120+ | 5 | 6 | 70K | $0.021 |
| SaaS platform | 350 | 5 | 6 | 90K | $0.027 |
| Monorepo (9 svc) | 700 | 9 | 10 | 200K | $0.058 |
| Enterprise app | 2500 | 12 | 13 | 500K | $0.145 |

## How Tokens Are Spent

### Phase A: Domain Detection (1 call)
```
Input:  directory tree + import graph + quality flags → ~5K tokens
Output: domain boundaries → ~1K tokens
Cost:   ~$0.002 (DeepSeek)
```

### Phase B: Per-Domain Deep Analysis (N calls)
```
Input:  system prompt + ALL files in domain + quality flags → ~15K tokens per domain
Output: agent .md content + quality report → ~3K tokens per domain
Cost:   ~$0.005 per domain (DeepSeek)
```

### Phase C: Build (0 calls)
```
Local file writes. 0 tokens. 0 cost.
```

## Why DeepSeek is Recommended

1. **40x cheaper than Claude** for the same task
2. **OpenAI-compatible API** — zero integration complexity. Same SDK as GPT-4o.
3. **128K context** — handles any domain's full file contents
4. **Same quality** for structured analysis as Claude/GPT-4o
5. **No rate limit concerns** at this volume

## You Control Cost

```bash
# Cheapest: DeepSeek (recommended)
export DEEPSEEK_API_KEY=sk-...
npx genesis .

# Best analysis: Claude
export ANTHROPIC_API_KEY=sk-ant-...
npx genesis . --provider claude

# Widely available: OpenAI
export OPENAI_API_KEY=sk-...
npx genesis . --provider openai

# Use your Copilot subscription
npx genesis . --provider opencode
```

## Free-Tier Viability

At DeepSeek pricing:
- 500 project analyses = $1.00
- 1 project analysis = $0.002
- Genesis is effectively free to use

## No Hidden Costs

- Genesis never proxies API calls. Direct from your machine to the provider.
- Genesis never adds markup. You pay exactly what the provider charges.
- Genesis never caches or stores your code. No server. No database.
- Genesis is MIT licensed. No subscription. No platform fee.
