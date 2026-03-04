# Resume Agent - Knowledge Transfer (Extensive)

Last updated: March 4, 2026
Owner: Bonny MakanianKhondo

## 1. Why this file exists
This is the handoff source of truth for resuming work in a new chat quickly without losing context.

It covers:
- Current architecture and runtime
- What was recently implemented
- Known issues and why they happen
- Immediate next steps in priority order
- A copy/paste bootstrap prompt for a new chat

---

## 2. Product state right now

Core product flows that are working:
- Upload master resume and parse into DB
- Create tailored resume from job description and URL import
- Generate cover letters using job description + My Story + Voice Profile
- Save and manage resumes/cover letters/stories in dashboard UI

Major quality upgrades recently completed:
- Tailor pipeline changed from one-shot generation to 3-step pipeline:
1. Job extraction
2. Resume evidence mapping
3. Targeted rewrite using evidence IDs
- Tailoring now prefers immutable uploaded snapshot (`uploadSnapshot`) instead of mutating master resume content
- Summary generation has stronger formatting and cleanup rules
- Cover letter generation follows formal structure and includes URL-imported job details

---

## 3. Architecture and key paths

Monorepo:
- `packages/client` - Next.js frontend
- `packages/server` - Fastify API
- `packages/shared` - Prisma client/types
- `src` - legacy CLI/migrated agent sources still present

Primary backend entrypoint:
- `packages/server/src/index.ts`

Primary LLM abstraction:
- `packages/server/src/services/llm.service.ts`

Resume parsing:
- `packages/server/src/parser.ts`

Client pages most relevant to current work:
- `packages/client/src/app/dashboard/tailor/page.tsx`
- `packages/client/src/app/dashboard/cover-letter/page.tsx`
- `packages/client/src/app/dashboard/resumes/[id]/...` (details/experience views)

---

## 4. Tailoring pipeline (current implementation)

Route:
- `POST /api/resumes/:id/tailor`

Current pipeline stages:
1. Build baseline source from immutable snapshot when available (`uploadSnapshot`), fallback to legacy data.
2. Extract structured job profile (`mustHaveSkills`, `responsibilities`, `keywords`, `roleFocus`).
3. Build evidence bullets from experience/project descriptions (+ achievements + technologies when available).
4. Rank evidence and map responsibilities to evidence IDs.
5. Rewrite summaries + experience content using selected evidence IDs.
6. Apply summary quality checks and alignment checks.
7. Save tailored resume with metadata in `resumeData.tailoredFor`.

Saved metadata now includes:
- `jobExtraction`
- `evidenceSelection`
- `alignmentScore`
- `alignmentKeywordCoverage`
- `alignmentResponsibilityCoverage`
- `summaryQualityScore`
- `summaryQualityIssues`
- `sourceResumeMode` (`upload_snapshot` or `editable_resume`)

Why this matters:
- You can inspect poor outputs by reading `tailoredFor` diagnostics in Raw Data tab.

---

## 5. Critical fixes recently applied

### 5.1 Summary quality
- Enforced short summary length and paragraph structure
- Long summary gets de-duplication and overlap reduction against short summary
- Added repair pass when summary quality score is low

### 5.2 Experience relevance
- Evidence selector now biases toward experience bullets (not only projects)
- Introduced minimum required experience evidence inclusion for rewrite stage
- Added identity anchor to avoid random title drift (example: switching to "Data Engineer" without clear evidence)

### 5.3 Immutable source integrity
- Tailoring uses `uploadSnapshot` first to avoid tailored changes polluting master source

### 5.4 Cover letter generation
- Added formal structure constraints (header/date/employer/salutation/body/closing/sign-off)
- Added URL import usage in cover letter flow
- Injected My Story + Voice Profile into prompt
- Added rescue fallback when model body is empty
- Added deterministic tone post-processing + tone assessment (professional/friendly/enthusiastic/formal)
- Added structure/tone validation scripts:
  - `pnpm -C packages/server run validate:cover-letter-tones`
  - `pnpm -C packages/server run validate:cover-letter-structure`

### 5.5 Multi-LLM provider behavior
- Provider controlled by env (`LLM_PROVIDER`)
- Fallback chains support Cohere/Gemini/HuggingFace/Anthropic combinations

---

## 6. Known issues (current)

### 6.1 `[object Object]` in experience descriptions
Symptom:
- Experience cards show text like `[object Object]`.

Root cause:
- Achievement object arrays were being coerced into strings during evidence merging.

Fix status:
- Backend sanitizer and achievement extraction path was patched to avoid object-stringification.
- Defensive cleanup strips `[object Object]` in description sanitation.

Important note:
- Existing already-saved tailored resumes still contain bad text and must be regenerated or cleaned.

### 6.2 Skill noise in parsed snapshot
Symptom:
- `uploadSnapshot.skills` may include junk tokens (label-like fragments, malformed entries).

Fix status:
- Parser normalization pass now runs in `packages/server/src/parser.ts` before save/merge.
- Added token cleanup for labels/noise fragments and canonical formatting for common skills.

Follow-up:
- Validate with 2-3 real resume uploads to confirm noisy fragments are no longer persisted.

### 6.3 TypeScript build noise
Server `tsc` shows existing project-level issues unrelated to latest features:
- shared output not built (`TS6305`)
- module/top-level await config issues (`TS1343`, `TS1378`)
- some legacy implicit `any` warnings

These are not new functional blockers for dev runtime but should be cleaned.

### 6.4 Upload Snapshot Bullets
Status:
- Validation script confirms `uploadSnapshot.experiences[].bullets` are now populated.
- Backfill script was run on existing rows to populate missing bullets from description + achievements.

Scripts:
- `pnpm -C packages/server run backfill:upload-bullets`
- `pnpm -C packages/server run backfill:upload-bullets:apply`
- `pnpm -C packages/server run validate:upload-bullets`

---

## 7. Debug playbook for bad tailored output

When tailoring looks wrong, inspect this order:
1. Raw Data -> `tailoredFor.jobExtraction`
- If keywords/responsibilities are weak, improve extraction prompt/fallback.
2. Raw Data -> `tailoredFor.evidenceSelection.selectedEvidenceIds`
- If mostly `proj_*` and few/no `exp_*`, evidence ranking is still off.
3. Raw Data -> `tailoredFor.alignmentScore`, `alignmentKeywordCoverage`, `alignmentResponsibilityCoverage`
- Low values confirm job alignment failure.
4. Raw Data -> `tailoredExperiences`
- Check whether rewrite actually changed experience text.

Target healthy signals:
- `selectedEvidenceIds` includes several `exp_*` entries
- `alignmentKeywordCoverage` >= 0.45
- `alignmentResponsibilityCoverage` >= 0.50
- no `[object Object]` artifacts

---

## 8. Immediate priority backlog

Priority 1:
- Add one-time cleanup for existing bad records containing `[object Object]`.
- Ensure experience rewrite uses bullet preservation better (2-4 strongest bullets/role, avoid collapsing to one sentence).

Priority 2:
- Improve job extraction keyword taxonomy (expand synonyms by role focus).

Priority 3:
- Wire remaining `/api/agents/*` endpoints to migrated agent classes (remove inline legacy prompt blocks in `index.ts` over time).

Priority 4:
- Stabilize TypeScript project config for clean `tsc --noEmit`.

---

## 9. Safe testing checklist after any tailoring changes

1. Upload master resume.
2. Tailor against a job with explicit numbered responsibilities.
3. Verify in UI:
- Summary short is 3-5 sentences
- Long is 2-3 paragraphs
- Experience descriptions are role-relevant and artifact-free
4. Verify Raw Data:
- `jobExtraction` present
- `selectedEvidenceIds` includes multiple `exp_*`
- alignment metrics not near zero
5. Generate cover letter from same job and verify structure remains intact.

---

## 10. Environment notes

Important env variables in use:
- `LLM_PROVIDER`
- `ALLOW_ANTHROPIC_FALLBACK`
- `ANTHROPIC_API_KEY`
- `COHERE_API_KEY`
- `GEMINI_API_KEY`
- `HUGGINGFACE_API_KEY`
- `JWT_SECRET`

Runtime note:
- If provider behavior seems unchanged, restart server after `.env` edits.

---

## 11. Commands

Dev:
- `pnpm -C packages/server dev`
- `pnpm -C packages/client dev`

Type checks:
- `pnpm -C packages/client exec tsc --noEmit --pretty false`
- `pnpm -C packages/server exec tsc --noEmit --pretty false`

---

## 12. New chat bootstrap prompt (copy/paste)

Use this in a new chat:

```text
Continue development on resume-agent using docs/KNOWLEDGE_TRANSFER.md as source of truth.
Focus first on tailoring quality and experience relevance.

Constraints:
1) Do not regress cover letter generation.
2) Preserve immutable source behavior (uploadSnapshot-first).
3) Keep summary rules (short 3-5 sentences, long 2-3 paragraphs).
4) Diagnose by reading tailoredFor diagnostics in resumeData.

First tasks:
- Confirm [object Object] cleanup path and add one-time cleanup for existing records.
- Improve experience rewrite quality per role (2-4 strong bullets per role).
- Improve parser skill normalization to remove noisy tokens.
```

---

## 13. Decision log snapshot

- Moved from one-shot tailoring to staged pipeline for relevance control.
- Kept Anthropic available but allowed configurable provider fallback.
- Chose immutable upload snapshot as tailoring source to avoid master resume drift.
- Added metadata-heavy diagnostics in `tailoredFor` to make failures inspectable.
- Added defensive text cleanup because generation pipeline can still surface malformed input artifacts.
- Wired `/api/agents/quantify-achievements` to `AchievementQuantifierAgent` and preserved the existing `{ result: ... }` API response wrapper for UI compatibility.
- Wired `/api/agents/harvard-summary` to `HarvardSummaryAgent`, preserving the existing UI contract by mapping agent `versions` into `{ result: { summaries: [{ version, style, text }] } }`.
- Wired `/api/agents/ats-optimize` to `ATSOptimizerAgent`, preserving current UI compatibility by mapping agent analysis into legacy fields (`score`, `keywordsFound`, `keywordsMissing`, `suggestions`, `optimizedBullets`) within `{ result: ... }`.
- Wired `/api/agents/behavioral-coach` to `BehavioralCoachAgent`, preserving UI compatibility by mapping agent output into legacy `result.stories[]` fields (`category`, `question`, `situation`, `task`, `action`, `result`, `metrics`).
- Wired `ResumeTailorAgent` into API orchestration via `POST /api/agents/resume-tailor` and added optional `resumeId` support in tailor/summary/enhanced pipeline methods to avoid `findFirst()` drift in multi-resume accounts.
- Wired `ApplicationOrchestratorAgent` into API via `POST /api/agents/application-orchestrator` so end-to-end workflow can be triggered from server routes with a stable `{ result: ... }` wrapper; route now accepts optional `resumeId` for resume-targeted orchestration.
- Extended orchestration workflow to generate and persist follow-up email drafts (`EmailAgent`) and exposed output in API result (`followUpEmail`), alongside hiring manager and LinkedIn outputs.
- Integrated a UI-driven full workflow action in `dashboard/tailor` that calls the orchestrator route and renders hiring manager info, LinkedIn draft, and email draft in preview.
