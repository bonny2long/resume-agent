# Resume Agent

An AI-powered job application assistant that helps you create custom resumes, cover letters, and LinkedIn outreach messages. Features elite career consultant-powered tools inspired by McKinsey, Harvard, Google, Bain, and other top firms.

## Features

### Core Application Workflow
- **Smart Resume Tailoring**: Automatically tailors your master resume to match job requirements using semantic similarity and RAG
- **Cover Letter Generation**: Creates personalized cover letters based on company research
- **Hiring Manager Research**: Finds and profiles hiring managers for direct outreach
- **LinkedIn Message Generator**: Creates personalized connection requests optimized for LinkedIn
- **Email Generation**: Generates professional follow-up emails for various application stages

### Enhanced Pipeline (Elite Career Consultants)
Power your applications with prompts inspired by top career consulting firms:

| Firm | Feature | Command |
|------|---------|---------|
| McKinsey & Co | Achievement Quantifier | `enhance quantify` |
| Google | ATS Optimizer | `enhance ats <job-id>` |
| Harvard Business School | Summary Generator | `enhance summary <job-id>` |
| Bain & Company | Cover Letter | `cover-letter <job-id>` |
| Meta (FAANG) | Interview Coach | `enhance interview <role>` |
| Spencer Stuart | LinkedIn Optimizer | `enhance linkedin <role>` |
| Robert Half | Salary Negotiator | `enhance salary <job-id>` |
| Heidrick & Struggles | Personal Brand | `enhance brand <role>` |
| Korn Ferry | Career Pivot | `enhance pivot` |

### Technical Features
- **RAG-Based Matching**: Semantic similarity matching for relevant experiences/projects
- **Multi-Provider AI**: Supports Anthropic Claude, Google Gemini, Cohere, and Hugging Face
- **Vector Search**: pgvector-powered semantic search
- **Application Tracking**: Tracks all applications in PostgreSQL
- **GitHub Integration**: Pulls project info and extracts engineering skills

## Tech Stack

- **Language**: TypeScript + Node.js
- **Database**: PostgreSQL with pgvector
- **AI/LLM**: Anthropic Claude, Google Gemini, Cohere, Hugging Face
- **ORM**: Prisma
- **CLI**: Commander.js + Inquirer.js
- **Document Processing**: docx, pdf-lib, mammoth

## Prerequisites

- **Node.js** 18.0.0 or higher
- **PostgreSQL** 12.0+ with pgvector extension
- **API Keys** (see installation below)

## Installation

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd resume-agent
npm install
```

### 2. Set Up PostgreSQL

```bash
psql -U postgres

# In psql console
CREATE DATABASE resume_agent;
CREATE USER resume_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE resume_agent TO resume_user;
\q

# Install pgvector extension
psql -U postgres -d resume_agent -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database
DATABASE_URL="postgresql://resume_user:your_password@localhost:5432/resume_agent"

# LLM Provider (Required)
ANTHROPIC_API_KEY="sk-ant-api03-..."

# Embeddings Provider (Required)
GEMINI_API_KEY="..."
# or
COHERE_API_KEY="..."

# Optional
GITHUB_TOKEN="ghp_..."
HUNTER_API_KEY="..."
APOLLO_API_KEY="..."
```

### 4. Initialize Database

```bash
npx prisma migrate dev --name init
npx prisma generate
npm run build
```

### 5. Initialize Your Master Resume

```bash
npm run dev init
```

## Quick Start

### Full Application Workflow

```bash
# Standard 6-step workflow
npm run dev -- apply <job-url>

# Enhanced 7-step workflow (includes McKinsey quant, Harvard summaries, ATS, interview prep)
npm run dev -- apply <job-url> --enhanced
```

### Step-by-Step

```bash
# 1. Analyze a job
npm run dev -- analyze <job-url>

# 2. Tailor resume (use --enhanced for full pipeline)
npm run dev -- tailor <job-id>
npm run dev -- tailor <job-id> --enhanced

# 3. Generate documents
npm run dev -- generate <job-id>

# 4. Generate cover letter
npm run dev -- cover-letter <job-id>

# 5. Find hiring manager
npm run dev -- find-manager <job-id>

# 6. Generate LinkedIn message
npm run dev -- linkedin-message <job-id>
```

### Enhanced Pipeline Commands

```bash
# Quantify achievements with McKinsey-style metrics
npm run dev -- enhance quantify

# ATS optimization report
npm run dev -- enhance ats <job-id>

# Generate 5 Harvard-style summaries
npm run dev -- enhance summary <job-id>

# FAANG-style interview prep
npm run dev -- enhance interview "Software Engineer"

# LinkedIn profile optimization
npm run dev -- enhance linkedin "Full Stack Engineer"

# Salary negotiation strategy
npm run dev -- enhance salary <job-id>

# Personal brand strategy
npm run dev -- enhance brand "Tech Lead"

# Career pivot plan
npm run dev -- enhance pivot
```

## Project Structure

```
resume-agent/
├── src/
│   ├── agents/                    # AI agents
│   │   ├── resume/               # Resume enhancement agents
│   │   │   ├── achievement-quantifier.agent.ts    # McKinsey-style
│   │   │   ├── harvard-summary.agent.ts           # Harvard-style
│   │   │   └── ats-optimizer.agent.ts             # Google-style
│   │   ├── interview/           # Interview prep agents
│   │   │   └── behavioral-coach.agent.ts          # FAANG-style
│   │   ├── career/             # Career development agents
│   │   │   ├── salary-negotiator.agent.ts         # Robert Half
│   │   │   ├── personal-brand.agent.ts            # Heidrick & Struggles
│   │   │   └── career-pivot.agent.ts              # Korn Ferry
│   │   ├── linkedin/           # LinkedIn optimization
│   │   │   └── linkedin-optimizer.agent.ts        # Spencer Stuart
│   │   ├── resume-tailor.agent.ts
│   │   ├── cover-letter-generator.ts
│   │   ├── job-analyzer.ts
│   │   ├── application-orchestrator.agent.ts
│   │   └── ...
│   ├── services/               # Core services
│   │   ├── llm.service.ts
│   │   ├── embeddings.service.ts
│   │   ├── document-generator.service.ts
│   │   └── ...
│   ├── cli/                   # CLI commands
│   └── database/              # Prisma client
├── prisma/
│   └── schema.prisma          # Database schema
└── docs/                      # Documentation
    ├── README.md              # This file
    ├── CLI_COMMANDS.md        # Full CLI reference
    └── AGENTS/                # Agent documentation
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize project and master resume |
| `resume` | Manage master resume |
| `analyze <url>` | Analyze job posting |
| `jobs list` | List all jobs |
| `tailor <job-id>` | Tailor resume to job |
| `tailor <job-id> --enhanced` | Tailor with enhanced pipeline |
| `generate <job-id>` | Generate DOCX resume |
| `cover-letter <job-id>` | Generate cover letter |
| `find-manager <job-id>` | Find hiring manager |
| `linkedin-message <job-id>` | Generate LinkedIn message |
| `email <job-id>` | Generate follow-up email |
| `apply <url>` | Full application workflow |
| `apply <url> --enhanced` | Enhanced application workflow |
| `enhance quantify` | McKinsey achievement quantifier |
| `enhance ats <job-id>` | ATS optimization |
| `enhance summary <job-id>` | Harvard summaries |
| `enhance interview <role>` | FAANG interview prep |
| `enhance linkedin <role>` | LinkedIn optimization |
| `enhance salary <job-id>` | Salary negotiation |
| `enhance brand <role>` | Personal brand |
| `enhance pivot` | Career pivot plan |
| `credits` | Check API usage |
| `status` | View application status |

## Development

```bash
# Run in development mode
npm run dev

# Build
npm run build

# Open database studio
npm run db:studio

# Reset database
npm run reset
```

## Documentation

- **[CLI_COMMANDS.md](CLI_COMMANDS.md)** - Complete CLI command reference
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Technical architecture overview
- **[AGENTS/](AGENTS/)** - Agent-specific documentation

## Troubleshooting

### Database Issues
```bash
npx prisma migrate reset
npx prisma generate
```

### API Key Issues
- Ensure `.env` is in the root directory
- Verify keys are valid in their respective consoles

## License

MIT
