# Resume Agent - Next Steps Execution Plan

Last updated: March 4, 2026

## Goal
Move from "stable tailoring + cover letter generation" to full agent-connected API workflows, while keeping UI behavior stable.

## Current Baseline (Done)
- Tailor pipeline upgraded to extract -> map -> rewrite flow.
- Cover letter generation integrated with My Story + voice + URL import.
- Tone and education-claim guards added.
- Immutable source-first tailoring (`uploadSnapshot`) in place.

---

## Phase 1 - Immediate (Next 1-2 sessions)

### 1) Data Quality Cleanup
- [x] Add one-time cleanup for existing records containing `[object Object]`.
  - Implemented script: `packages/server/src/scripts/cleanup-object-object.ts`
  - Commands:
    - `pnpm -C packages/server run cleanup:object-artifacts:dry`
    - `pnpm -C packages/server run cleanup:object-artifacts`
  - Last run result (March 3, 2026): 0 affected rows in current DB
- [x] Add parser skill normalization pass to reduce noisy skill tokens on upload.
- [x] Validate that `uploadSnapshot.experiences[].bullets` are populated from description + achievements.
  - Added scripts:
    - `pnpm -C packages/server run backfill:upload-bullets`
    - `pnpm -C packages/server run backfill:upload-bullets:apply`
    - `pnpm -C packages/server run validate:upload-bullets`
  - Last run result (March 3, 2026): `bulletCoverage=1` on current DB after backfill.

Acceptance:
- No `[object Object]` in newly generated or cleaned resume descriptions.
- Upload output no longer includes obvious junk skills (location fragments, role labels, malformed tokens).

### 2) Cover Letter Stability Hardening
- [x] Verify each tone (`professional`, `enthusiastic`, `friendly`, `formal`) produces distinct style.
  - Added deterministic tone post-processing + tone assessment in API flow.
  - Added script: `pnpm -C packages/server run validate:cover-letter-tones`
  - Last run result (March 3, 2026): distinct tone signatures validated.
- [x] Add regression tests/fixtures for letter structure (header/date/employer/salutation/4-paragraph body/sign-off).
  - Added script fixture validator: `pnpm -C packages/server run validate:cover-letter-structure`
  - Last run result (March 3, 2026): fixture passed with no structure issues.

Acceptance:
- Same job/resume with different tones yields noticeably different text style.
- Format stays multi-paragraph and readable.

---

## Phase 2 - Agent Endpoint Wiring (Core Plan)

Wire existing `/api/agents/*` routes to migrated agent classes while preserving response shapes.

### 1) Quantify Achievements
- Route: `/api/agents/quantify-achievements`
- Target agent: `packages/server/src/agents/resume/achievement-quantifier.agent.ts`
- [x] Replace inline prompt logic with agent call
- [x] Keep current API response contract
  - Implemented (March 4, 2026): route now calls `AchievementQuantifierAgent.quantifyResumeAchievements(resumeId)` and still returns `{ result: ... }`.

### 2) Harvard Summary
- Route: `/api/agents/harvard-summary`
- Target agent: `packages/server/src/agents/resume/harvard-summary.agent.ts`
- [x] Replace inline prompt logic with agent call
- [x] Keep current API response contract
  - Implemented (March 4, 2026): route now calls `HarvardSummaryAgent.generateSummaries(undefined, resumeId)` and maps agent `versions` to UI-compatible `{ result: { summaries: [{ version, style, text }] } }`.

### 3) ATS Optimize
- Route: `/api/agents/ats-optimize`
- Target agent: `packages/server/src/agents/resume/ats-optimizer.agent.ts`
- [x] Replace inline prompt logic with agent call
- [x] Keep current API response contract
  - Implemented (March 4, 2026): route now calls `ATSOptimizerAgent.analyzeResumeATS(resumeText, jobDescription)` and maps output to legacy UI fields (`score`, `keywordsFound`, `keywordsMissing`, `suggestions`, `optimizedBullets`) inside `{ result: ... }`.

### 4) Behavioral Coach
- Route: `/api/agents/behavioral-coach`
- Target agent: `packages/server/src/agents/interview/behavioral-coach.agent.ts`
- [x] Replace inline prompt logic with agent call
- [x] Keep current API response contract
  - Implemented (March 4, 2026): route now calls `BehavioralCoachAgent.generateStoryBank(undefined, resumeId)` and maps stories to UI-compatible `{ result: { stories: [{ category, question, situation, task, action, result, metrics }] } }`.

Acceptance for each route:
- Endpoint returns expected JSON shape.
- Existing UI screens keep working without frontend changes.
- No factual-regression in generated content.

---

## Phase 3 - Application Orchestration

- [x] Wire `resume-tailor.agent.ts` to API orchestration layer (where useful, avoid duplicated logic).
  - Implemented (March 4, 2026): added `POST /api/agents/resume-tailor` calling `ResumeTailorAgent.tailorResume(jobId, { enhanced, resumeId })` with ownership checks and `{ result: ... }` response wrapper.
- [x] Wire `application-orchestrator.agent.ts` for end-to-end apply workflow.
  - Implemented (March 4, 2026): added `POST /api/agents/application-orchestrator` calling `ApplicationOrchestratorAgent.applyToJob(jobUrl, { enhanced, resumeId })` with `{ result: ... }` response wrapper.
- [x] Integrate hiring manager + LinkedIn + email agents in UI-driven flow.
  - Implemented (March 4, 2026): `dashboard/tailor` now runs full workflow via `/api/agents/application-orchestrator` and renders hiring manager details, LinkedIn message draft, and follow-up email draft in Preview.

Acceptance:
- One API workflow can execute: analyze job -> tailor -> cover letter -> manager/contact output.

---

## Phase 4 - Technical Debt + Reliability

### TypeScript/Build
- [ ] Fix server TS config/module issues (`TS1343`, `TS1378`).
- [ ] Fix shared output dependency issue (`TS6305`) in local dev flow.
- [ ] Reduce legacy implicit `any` warnings in `packages/server/src/index.ts`.

### Cleanup
- [ ] Remove duplicated inline prompt blocks in `index.ts` after agent parity is complete.
- [ ] Deprecate/remove old CLI runtime paths only after endpoint parity is confirmed.

---

## Session Start Checklist

Before coding:
1. Read `docs/KNOWLEDGE_TRANSFER.md`.
2. Read this file (`docs/NEXT_STEPS.md`).
3. Pick one phase item and finish end-to-end (code + verify + doc update).

After coding:
1. Update this file checkboxes.
2. Update `docs/KNOWLEDGE_TRANSFER.md` decision log if architecture changed.
3. Record any new blockers in `docs/build_errors.txt` or `docs/TROUBLESHOOTING.md`.

---

## Recommended Next Task (Start Here)

Implement Phase 2, item 1:
- Connect `/api/agents/quantify-achievements` to migrated agent class
- Preserve response shape
- Add a quick verification run and document result
