# Resume Agent 🤖

An AI-powered resume tailoring and job application assistant that helps you create custom resumes, cover letters, and LinkedIn outreach messages for each job application.

## Features

- 📝 **Smart Resume Tailoring**: Automatically tailors your master resume to match job requirements
- 💼 **Cover Letter Generation**: Creates personalized cover letters based on company research
- 🔍 **Hiring Manager Research**: Finds and profiles hiring managers for direct outreach
- 💬 **LinkedIn Message Generator**: Creates personalized connection requests and messages
- 📊 **ATS Optimization**: Ensures resumes pass Applicant Tracking Systems
- 🎯 **Application Tracking**: Tracks all applications and their status
- 🔄 **GitHub Integration**: Automatically pulls project information from your repos

## Tech Stack

- **Language**: TypeScript + Node.js
- **Database**: PostgreSQL with pgvector
- **AI/LLM**: Claude 4.5 (Anthropic)
- **ORM**: Prisma
- **CLI**: Commander.js + Inquirer.js

## Prerequisites

Before you begin, ensure you have:

- **Node.js** 18.0.0 or higher
- **PostgreSQL** 12.0 or higher
- **npm** or **yarn**
- API Keys:
  - Anthropic API key (required)
  - GitHub Personal Access Token (optional)
  - OpenAI API key (optional, for embeddings)

## Installation

### 1. Clone the Repository

\`\`\`bash
git clone <your-repo-url>
cd resume-agent
\`\`\`

### 2. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 3. Set Up PostgreSQL Database

Create a new PostgreSQL database:

\`\`\`bash

# Using psql

psql -U postgres

# In psql console

CREATE DATABASE resume_agent;
CREATE USER resume_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE resume_agent TO resume_user;
\q
\`\`\`

Install pgvector extension:

\`\`\`bash
psql -U postgres -d resume_agent -c "CREATE EXTENSION IF NOT EXISTS vector;"
\`\`\`

### 4. Configure Environment Variables

Create a \`.env\` file in the root directory:

\`\`\`bash
cp .env.example .env
\`\`\`

Edit \`.env\` and add your credentials:

\`\`\`env

# Database

DATABASE_URL="postgresql://resume_user:your_password@localhost:5432/resume_agent"

# Anthropic API (Required)

ANTHROPIC_API_KEY="sk-ant-api03-..."

# GitHub Token (Optional but recommended)

GITHUB*TOKEN="ghp*..."

# OpenAI (Optional - for embeddings)

OPENAI_API_KEY="sk-..."
\`\`\`

### 5. Get Your API Keys

#### Anthropic API Key (Required)

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to Settings → API Keys
4. Click "Create Key"
5. Copy the key (starts with \`sk-ant-api03-\`)

#### GitHub Personal Access Token (Optional)

1. Go to [GitHub Settings](https://github.com/settings/tokens)
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a name (e.g., "Resume Agent")
4. Select scopes:
   - ✅ \`repo\` (for private repos)
   - ✅ \`read:user\`
5. Click "Generate token"
6. Copy the token (starts with \`ghp\_\`)

### 6. Run Database Migrations

\`\`\`bash
npx prisma migrate dev --name init
npx prisma generate
\`\`\`

### 7. Build the Project

\`\`\`bash
npm run build
\`\`\`

## Usage

### Initialize Your Master Resume

\`\`\`bash
npm run dev init
\`\`\`

This will guide you through creating your master resume with:

- Personal information
- Professional summary
- Contact details

### Add Work Experience

\`\`\`bash
npm run dev resume add-experience
\`\`\`

### Add Projects

\`\`\`bash
npm run dev resume add-project
\`\`\`

### Apply for a Job

\`\`\`bash
npm run dev apply <job-url>
\`\`\`

This will:

1. Analyze the job posting
2. Research the company
3. Tailor your resume
4. Generate a cover letter
5. Find hiring managers
6. Create LinkedIn messages

### View Application Status

\`\`\`bash
npm run dev status
\`\`\`

### Research a Company

\`\`\`bash
npm run dev research "Company Name"
\`\`\`

## Project Structure

\`\`\`
resume-agent/
├── src/
│ ├── agents/ # AI agents for different tasks
│ ├── services/ # Core services (LLM, GitHub, etc.)
│ ├── database/ # Database client and repositories
│ ├── cli/ # CLI commands
│ ├── utils/ # Utility functions
│ ├── types/ # TypeScript type definitions
│ ├── config/ # Configuration
│ └── templates/ # Document templates
├── data/
│ ├── outputs/ # Generated resumes and cover letters
│ ├── cache/ # Cached data
│ └── uploads/ # User uploads
├── prisma/
│ └── schema.prisma # Database schema
└── tests/ # Tests
\`\`\`

## Development Roadmap

### ✅ Phase 0: Foundation (Week 1)

- [x] Project setup
- [x] Database schema
- [x] CLI foundation
- [x] LLM service
- [x] Basic configuration

### 🚧 Phase 1: Master Resume (Week 2)

- [ ] Experience management
- [ ] Project management
- [ ] Skills management
- [ ] GitHub integration
- [ ] Embedding generation

### 📅 Phase 2: Job Analysis (Week 3)

- [ ] Job posting parser
- [ ] Company research agent
- [ ] Match scoring
- [ ] Keyword extraction

### 📅 Phase 3: Resume Generation (Week 4)

- [ ] Resume tailoring agent
- [ ] ATS optimization
- [ ] Document generation (PDF/DOCX)
- [ ] Template system

### 📅 Phase 4: Cover Letters (Week 5)

- [ ] Cover letter generator
- [ ] Personalization engine
- [ ] Multiple variants

### 📅 Phase 5: Hiring Manager Research (Week 6)

- [ ] LinkedIn search queries
- [ ] Company website scraping
- [ ] Screenshot upload/OCR
- [ ] Confidence scoring

### 📅 Phase 6: LinkedIn Messages (Week 7)

- [ ] Message generation
- [ ] Personalization
- [ ] Variant creation

### 📅 Phase 7: Orchestration (Week 8)

- [ ] Complete workflow
- [ ] Application packages
- [ ] Strategy generation

### 📅 Phase 8: Tracking (Week 9)

- [ ] Status dashboard
- [ ] Analytics
- [ ] Follow-up system

## Troubleshooting

### Database Connection Issues

\`\`\`bash

# Check if PostgreSQL is running

sudo service postgresql status

# Restart PostgreSQL

sudo service postgresql restart

# Test connection

psql -U resume_user -d resume_agent
\`\`\`

### Prisma Issues

\`\`\`bash

# Reset database

npx prisma migrate reset

# Re-generate Prisma client

npx prisma generate

# View database in browser

npx prisma studio
\`\`\`

### API Key Issues

- Make sure your \`.env\` file is in the root directory
- Check that API keys don't have extra spaces
- Verify keys are valid in their respective consoles

## Contributing

This is a personal project, but suggestions and feedback are welcome!

## License

MIT

## Acknowledgments

- Built with [Claude 4.5](https://www.anthropic.com/) by Anthropic
- Inspired by modern job search challenges
- Designed for full-stack engineers

---

**Current Status**: Phase 0 Complete ✅

Next up: Implementing master resume management in Week 2!
