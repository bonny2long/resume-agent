# Resume Agent - Knowledge Transfer

## Purpose
This document captures the current migration state from legacy CLI-first agent architecture to UI/API-first architecture, and defines the exact next steps.

## Current Direction
- Target architecture: UI (`packages/client`) + API (`packages/server`) as the primary runtime.
- Legacy CLI code under `src/` is being migrated into `packages/server/src/`.
- CLI removal should happen only after endpoint parity is complete.

## Monorepo Structure
```text
resume-agent/
|-- packages/
|   |-- client/      # Next.js UI
|   |-- server/      # Fastify API (migration target runtime)
|   `-- shared/      # Prisma client/types
|-- src/             # Legacy CLI runtime (to be deprecated after parity)
|-- prisma/
`-- docs/
```

## Migration Status (As of March 3, 2026)

### 1) Agent File Migration
- Legacy `src/agents/**` files: 18
- Migrated into `packages/server/src/agents/**`: 18 matching files
- Additional preserved copy: `packages/server/src/agents/job-analyzer.legacy.ts`

Result:
- File-level migration complete for all legacy agent files.

### 2) Supporting Code Migration
The following legacy directories were copied into `packages/server/src/` for compatibility:
- `config/`
- `database/`
- `services/`
- `types/`
- `utils/`

### 3) DB Client Bridge
`packages/server/src/database/client.ts` now bridges legacy agent DB usage to monorepo shared Prisma:
- Uses `@resume-agent/shared/src/client.js` instead of creating a second PrismaClient runtime.

### 4) Endpoint Wiring Completed
`POST /api/jobs/parse-url` is now wired to migrated server agent code:
- Route: `packages/server/src/index.ts`
- Runtime path: `packages/server/src/agents/job-analyzer.ts`
- Scraper used by analyzer: `packages/server/src/services/job-web-scraper.ts`

This is the first fully connected legacy-to-UI migration path.

### 5) Dependencies Added to Server Package
`packages/server/package.json` updated to support migrated agent stack:
- `axios`, `cheerio`, `chalk`, `dotenv`, `docx`, `puppeteer`
- `cohere-ai`, `@google/generative-ai`, `@huggingface/inference`
- `@prisma/client`

## What Is Not Done Yet
- Most migrated agents are not yet wired to API routes in `packages/server/src/index.ts`.
- Current `/api/agents/*` routes still use inline Anthropic prompting logic in `index.ts` instead of migrated class-based agents.
- Legacy code under `src/` has not been deleted yet.

## Route Parity Plan (Next)

### Phase 2: Wire Resume Enhancement Agents
Wire existing routes to migrated agents:
1. `/api/agents/quantify-achievements` -> `packages/server/src/agents/resume/achievement-quantifier.agent.ts`
2. `/api/agents/harvard-summary` -> `packages/server/src/agents/resume/harvard-summary.agent.ts`
3. `/api/agents/ats-optimize` -> `packages/server/src/agents/resume/ats-optimizer.agent.ts`
4. `/api/agents/behavioral-coach` -> `packages/server/src/agents/interview/behavioral-coach.agent.ts`

### Phase 3: Wire Application/Tailor Orchestration
Integrate migrated:
- `resume-tailor.agent.ts`
- `cover-letter-generator.ts`
- `application-orchestrator.agent.ts`
- supporting manager/linkedin/email agents

### Phase 4: Cleanup
After parity is verified:
1. Remove dead inline agent logic from `packages/server/src/index.ts`
2. Remove legacy CLI entrypoints under `src/cli`
3. Remove remaining duplicate runtime under `src/` (agents/services/utils/config/database) if fully unused
4. Keep docs updated to UI-first architecture only

## Quality and Safety Rules During Migration
- Keep endpoint contracts stable so UI does not break.
- Migrate internals first, endpoint shape second (only if needed).
- Preserve factual safety:
  - no fabricated claims,
  - preserve in-progress vs completed tense,
  - preserve source dates when tailoring experiences.
- Do not remove legacy runtime until route-by-route parity is proven.

## Validation Checklist
For each migrated route:
1. Endpoint returns expected JSON shape.
2. UI page using that endpoint works without frontend changes.
3. No regression in truthfulness/tense/date handling.
4. Results are readable (no raw JSON blob rendering regressions).

## Key Files
- API server: `packages/server/src/index.ts`
- Migrated job analyzer: `packages/server/src/agents/job-analyzer.ts`
- Migrated scraper for analyzer path: `packages/server/src/services/job-web-scraper.ts`
- Legacy agents source: `src/agents/`
- Migrated agents target: `packages/server/src/agents/`

## Operational Notes
- Server dev: `pnpm -C packages/server dev`
- Client dev: `pnpm -C packages/client dev`
- Shared Prisma source of truth: `@resume-agent/shared/src/client.js`

---
Last updated: March 3, 2026
