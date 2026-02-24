# Agents Overview

Resume Agent uses a multi-agent orchestration system where specialized agents work together to complete complex job application workflows.

## Agent Categories

### 1. Resume Enhancement Agents
Located: `src/agents/resume/`

- **Achievement Quantifier** (McKinsey-style) - Quantifies resume achievements with metrics
- **Harvard Summary Writer** - Generates 5 versions of professional summaries
- **ATS Optimizer** (Google-style) - Optimizes resumes for applicant tracking systems

### 2. Interview Preparation Agents
Located: `src/agents/interview/`

- **Behavioral Coach** (FAANG-style) - Generates STAR story banks for behavioral interviews

### 3. Career Development Agents
Located: `src/agents/career/`

- **Salary Negotiator** (Robert Half-style) - Creates negotiation strategies
- **Personal Brand Strategist** (Heidrick & Struggles-style) - Builds personal brand
- **Career Pivot Strategist** (Korn Ferry-style) - Plans career transitions

### 4. Application Agents
Located: `src/agents/`

- **Job Analyzer** - Scrapes and parses job postings
- **Resume Tailor** - Tailors resume to job requirements using RAG
- **Cover Letter Generator** (Bain-style) - Creates personalized cover letters
- **LinkedIn Optimizer** (Spencer Stuart-style) - Optimizes LinkedIn profiles
- **Hiring Manager Finder** - Finds and profiles hiring managers
- **Email Agent** - Generates follow-up emails

## How They Work Together

### Standard Workflow
```
analyze → tailor → generate → cover-letter → find-manager → linkedin-message
```

### Enhanced Workflow
```
analyze → (quantify + Harvard + ATS + cover letter + interview prep) → tailor → generate → cover-letter → find-manager → linkedin-message
```

The enhanced pipeline runs all 5 enhancement agents before tailoring, storing results in the database for retrieval on subsequent runs.

## Data Flow

1. **Input**: Job URL or existing job ID
2. **Analysis**: Job Analyzer extracts requirements, skills, keywords
3. **Enhancement** (optional): All enhancement agents run and save to DB
4. **Retrieval**: Resume Tailor pulls enhanced data from DB if available
5. **Generation**: Document Generator creates final output files
6. **Output**: Resume, cover letter, and outreach messages

## Database Integration

All agents save their outputs to PostgreSQL via Prisma:

- `QuantifiedAchievement` - McKinsey-style quantified achievements
- `EnhancedSummary` - Harvard summary versions
- `ATSAnalysis` - Google ATS optimization results
- `STARStory` - FAANG interview stories
- `Application` - Full application records
