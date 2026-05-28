# Use Case Scenarios — Genesis in Action

## 1. The Legacy Monolith

A developer joins a company with a 70,000-line Django codebase. No onboarding docs exist. Nobody knows all the modules. The codebase has natural seams — auth, payments, admin panel, notifications — but nobody documented them.

```
$ npx genesis .

🔍 Surveying legacy-django...

   Language     Python 3.10 (Django 4.2)
   Database     PostgreSQL (38 tables)
   Frontend     Django templates + Alpine.js
   Tests        203 total (167 passing, 36 failing)
   Deploy       Docker + Kubernetes

   📁 auth/              18 files   ████████░░
   📁 payments/          14 files   ███████░░░
   📁 admin_panel/       22 files   ██████████░░
   📁 notifications/     9 files    █████░░
   📁 api/               31 files   ██████████████░

🧠 Analyzing... 5 domains detected.

   API-DEV        ← api/ (31) + core/ (12 merged)
                   "43 files. Backbone. REST + shared models."

   AUTH-DEV       ← auth/ (18)
                   "JWT + OAuth2 + permissions. Isolated."

   PAYMENTS-DEV   ← payments/ (14)
                   "Stripe + invoices + webhooks."

   FRONTEND-DEV   ← admin_panel/ (22)
                   "Django templates + Alpine.js. CRUD views."

   REVIEWER       ← all files (read-only)

   ── notifications/ merged into API-DEV (9 files, shares models)

⚠️  36 tests failing. auth/views.py is 1,247 lines. 2 hardcoded Stripe keys.

Proceed? [Y/n]
```

**Result**: The developer has a team of AI agents that understands the monolith better than anyone. They ask `api-dev`: "Explain how payments flow through the system" — file:line precision.

---

## 2. The Microservices Fleet

A platform engineer manages a monorepo with 9 microservices. Each service has its own language, database, and deploy config. Cross-service dependencies are implicit.

```
$ npx genesis .

🔍 Surveying microservices-platform...

   Services    9 detected
   Languages   Go (8 services), TypeScript (1 gateway)

   📁 user-svc/           24 files   Go + PostgreSQL
   📁 order-svc/          18 files   Go + PostgreSQL
   📁 payment-svc/        12 files   Go + Stripe
   📁 notification/       8 files    Go + Redis
   📁 catalog-svc/        21 files   Go + Elasticsearch
   📁 shipping-svc/       11 files   Go
   📁 analytics/          15 files   Python + ClickHouse
   📁 auth-svc/           19 files   Go + Redis
   📁 gateway/            28 files   TypeScript + Express

🧠 9 services. Capping at 7 agents + orchestrator.

   1. USER-DEV       user-svc (24)
   2. ORDER-DEV      order-svc (18) + shipping-svc (11 merged)
   3. PAYMENT-DEV    payment-svc (12)
   4. CATALOG-DEV    catalog-svc (21)
   5. ANALYTICS-DEV  analytics/ (15, Python — different language)
   6. AUTH-DEV       auth-svc (19) + notification (8 merged, shares Redis)
   7. GATEWAY-DEV    gateway/ (28, TypeScript)

   + ORCHESTRATOR (primary — routes between 7 specialists)
   + REVIEWER (read-only)

⚠️  analytics/ is Python while everything else is Go
⚠️  payment-svc has zero tests
⚠️  No shared protobuf definitions — risk of contract drift
```

**Result**: One agent per service. The orchestrator routes cross-service tasks. "Add endpoint to user-svc and update gateway" → user-dev first, then gateway-dev. Boundaries enforced.

---

## 3. The Greenfield Founder

A founder has an idea but no code. They open an empty directory.

```
$ mkdir my-saas && cd my-saas
$ npx genesis .

🔍 Surveying my-saas...

   ⚠️  No code detected. This is a greenfield project.

   ┌────────────────────────────────────────────┐
   │ What are you building?                     │
   │                                            │
   │ > A SaaS dashboard for tracking carbon     │
   │ > emissions with AI recommendations        │
   └────────────────────────────────────────────┘

🧠 Analyzing...

   Recommended: Python (FastAPI) + React (TypeScript) + PostgreSQL.
   FastAPI handles AI integration well (async). React + Recharts for
   dashboards. PostgreSQL for structured emissions data.

   Proposed team (3 agents):
   BACKEND-DEV     API, AI integration, database models
   FRONTEND-DEV    Dashboard, charts, user interface
   REVIEWER        Gate before merge

   Scaffold project structure too? [Y/n]
```

**Result**: Agents + scaffolded project skeleton in under 3 minutes. The founder now has an AI team and a project to build on.

---

## 4. The Open Source Contributor

A developer wants to contribute to a large open source project but doesn't know where to start.

```
$ git clone https://github.com/tiangolo/fastapi
$ cd fastapi && npx genesis .

🔍 Surveying FastAPI...

   Language     Python 3.9+
   Tests        1,200+ (98% coverage)

   📁 fastapi/routing/         8 files
   📁 fastapi/dependencies/    6 files
   📁 fastapi/security/        9 files
   📁 fastapi/middleware/      5 files
   📁 fastapi/openapi/         7 files
   📁 fastapi/encoders/        4 files

🧠 4 domains identified.

   CORE-DEV       routing + dependencies + middleware + encoders (23 files)
   SECURITY-DEV   fastapi/security/ (9 files)
   OPENAPI-DEV    fastapi/openapi/ (7 files)
   REVIEWER       all files

📄 PROJECT-CONTEXT.md:
   FastAPI is a web framework built on Starlette. Core conventions:
   - All public APIs must have type hints (mypy enforced)
   - Tests use pytest + httpx TestClient
   - Routing is ASGI-compatible (Starlette based)
   - OpenAPI schema is auto-generated from route decorators
```

**Result**: Domain-specific agents. The contributor wants to add a security feature — they invoke `security-dev` which only touches `fastapi/security/`. The reviewer catches any Starlette API breakage.

---

## 5. The Agency Freelancer

A freelancer has 5 client projects, each in a different stack. Context switching is expensive.

```
~/clients/$ for dir in */; do cd "$dir" && npx genesis . --yes && cd ..; done

  client-a/ (Next.js e-commerce, TypeScript, Prisma, Stripe)
    → 3 agents: frontend-dev, backend-dev, db-engineer + reviewer

  client-b/ (Flask API, Python, MongoDB, Twilio)
    → 2 agents: api-dev + reviewer (monolith, small)

  client-c/ (React Native app, TypeScript, Firebase)
    → 2 agents: mobile-dev + reviewer

  client-d/ (WordPress plugin, PHP, MySQL)
    → 1 agent: plugin-dev + reviewer (8 files, single domain)

  client-e/ (CLI tool, Go, Cobra, GitHub Actions)
    → 1 agent: cli-dev + reviewer (12 files, single domain)
```

**Result**: Each client's project now has:
- `./prompts/*.md` — agents that know that specific codebase
- `./PROJECT-CONTEXT.md` — conventions, gotchas, tech decisions
- `./opencode.json` — configured team, ready to use

The freelancer switches projects. Each one has its own AI engineering team waiting. No context bleed.
