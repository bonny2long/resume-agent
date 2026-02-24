# Application Workflow Agents

Agents that handle the day-to-day job application process.

## Job Analyzer

**File**: `src/agents/job-analyzer.ts`

### What It Does
- Scrapes job postings from various ATS platforms (Workday, Greenhouse, Lever, iCIMS)
- Extracts structured data:
  - Job title
  - Company name
  - Location
  - Required skills
  - Preferred skills
  - Responsibilities
  - Qualifications
  - Salary range
  - Experience level

### CLI Command
```bash
npm run dev -- analyze <job-url>
```

---

## Resume Tailor

**File**: `src/agents/resume-tailor.agent.ts`

### What It Does
- Uses RAG (Retrieval Augmented Generation) to find relevant experiences
- Matches experiences/projects to job requirements using semantic embeddings
- Optimizes achievements for ATS
- Generates tailored professional summary

### Standard vs Enhanced

| Mode | Pipeline |
|------|----------|
| `tailor <job-id>` | Standard 5-step |
| `tailor <job-id> --enhanced` | Runs enhancement agents first |

### CLI Command
```bash
npm run dev -- tailor <job-id>
npm run dev -- tailor <job-id> --enhanced
```

---

## Cover Letter Generator (Bain & Company)

**File**: `src/agents/cover-letter-generator.ts`

**Inspiration**: Bain & Company consultants are known for concise, compelling business writing.

### What It Does
- Creates personalized cover letters
- Integrates career transition story
- Supports multiple tones:
  - Professional (default)
  - Enthusiastic
  - Friendly
- Includes company-specific research

### CLI Command
```bash
npm run dev -- cover-letter <job-id>
```

---

## Hiring Manager Finder

**File**: `src/agents/hiring-manager-finder.ts`

### What It Does
- Searches for hiring managers using:
  - Company website analysis
  - LinkedIn search
  - Third-party APIs (Hunter.io, Apollo)
- Ranks candidates by confidence
- Provides contact information

### CLI Command
```bash
npm run dev -- find-manager <job-id>
```

---

## LinkedIn Message Generator

**File**: `src/agents/linkedin-message-generator.ts`

### What It Does
- Generates connection requests
- Creates follow-up messages
- Optimizes for LinkedIn character limits
- Includes personalized icebreakers

### CLI Command
```bash
npm run dev -- linkedin-message <job-id>
npm run dev -- linkedin-message <job-id> --type connection_request
npm run dev -- linkedin-message <job-id> --type follow_up
```

---

## Email Agent

**File**: `src/agents/email-agent.ts`

### What It Does
Generates professional follow-up emails for:
- Initial follow-up (after applying)
- Post-interview thank you
- Check-in (weeks later)

### CLI Command
```bash
npm run dev -- email <job-id>
npm run dev -- email <job-id> --type post_interview
npm run dev -- email <job-id> --type check_in
```

---

## Application Orchestrator

**File**: `src/agents/application-orchestrator.agent.ts`

### What It Does
Coordinates the entire application workflow:

1. Analyze job posting
2. Tailor resume (optionally with enhanced pipeline)
3. Generate resume document
4. Generate cover letter
5. Find hiring manager
6. Generate LinkedIn message

### CLI Command
```bash
npm run dev -- apply <job-url>
npm run dev -- apply <job-url> --enhanced
```

---

## Complete Workflow Comparison

| Step | Standard | Enhanced |
|------|----------|----------|
| 1 | Analyze | Analyze |
| 2 | Tailor | Quantify + Harvard + ATS + Cover + Interview |
| 3 | Generate DOCX | Generate DOCX |
| 4 | Cover Letter | Cover Letter |
| 5 | Find Manager | Find Manager |
| 6 | LinkedIn Message | LinkedIn Message |

The enhanced pipeline enriches your master resume data before tailoring, making each subsequent application stronger.
