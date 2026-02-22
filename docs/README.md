# Resume Agent

An AI-powered resume tailoring and job application assistant that helps you create custom resumes, cover letters, and LinkedIn outreach messages for each job application.

## Features

- **Smart Resume Tailoring**: Automatically tailors your master resume to match job requirements using semantic similarity and RAG
- **Cover Letter Generation**: Creates personalized cover letters based on company research with multiple tone options
- **Hiring Manager Research**: Finds and profiles hiring managers for direct outreach using AI suggestions and third-party APIs
- **LinkedIn Message Generator**: Creates personalized connection requests and messages optimized for LinkedIn's character limits
- **Email Generation**: Generates professional follow-up emails for various application stages
- **ATS Optimization**: Ensures resumes pass Applicant Tracking Systems with keyword matching
- **Application Tracking**: Tracks all applications and their status in PostgreSQL
- **GitHub Integration**: Automatically pulls project information and extracts engineering skills from your repos
- **Multi-Provider AI**: Supports Anthropic Claude, Google Gemini, Cohere, and Hugging Face
- **Vector Search**: pgvector-powered semantic search for experience/project matching

## Tech Stack

- **Language**: TypeScript + Node.js
- **Database**: PostgreSQL with pgvector
- **AI/LLM**: Anthropic Claude, Google Gemini, Cohere, Hugging Face
- **ORM**: Prisma
- **CLI**: Commander.js + Inquirer.js
- **Document Processing**: docx, pdf-lib, mammoth
- **Web Scraping**: Puppeteer, Cheerio, Axios
- **Testing**: Vitest

## Prerequisites

Before you begin, ensure you have:

- **Node.js** 18.0.0 or higher
- **PostgreSQL** 12.0 or higher with pgvector extension
- **npm** or **yarn**
- API Keys:
  - Anthropic API key (required)
  - Gemini or Cohere API key (for embeddings)
  - GitHub Personal Access Token (optional)
  - Hunter.io / Apollo API key (optional, for contact finding)

## Installation

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd resume-agent
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up PostgreSQL Database

Create a new PostgreSQL database:

```bash
# Using psql
psql -U postgres

# In psql console
CREATE DATABASE resume_agent;
CREATE USER resume_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE resume_agent TO resume_user;
\q
```

Install pgvector extension:

```bash
psql -U postgres -d resume_agent -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 4. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
# Database
DATABASE_URL="postgresql://resume_user:your_password@localhost:5432/resume_agent"

# LLM Provider (Required)
ANTHROPIC_API_KEY="sk-ant-api03-..."

# Embeddings Provider (Required for semantic search)
GEMINI_API_KEY="..."
# or
COHERE_API_KEY="..."

# GitHub Token (Optional)
GITHUB_TOKEN="ghp_..."

# Contact Finding Services (Optional)
HUNTER_API_KEY="..."
APOLLO_API_KEY="..."
```

### 5. Run Database Migrations

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 6. Build the Project

```bash
npm run build
```

## Usage

### Initialize Your Master Resume

```bash
npm run dev init
```

### Add Work Experience

```bash
npm run dev resume add-experience
```

### Add Projects

```bash
npm run dev resume add-project
```

### Analyze a Job Posting

```bash
npm run dev analyze <job-url>
```

### Tailor Resume to a Job

```bash
npm run dev tailor <job-id>
```

### Generate Cover Letter

```bash
npm run dev cover-letter <job-id>
```

### Find Hiring Manager

```bash
npm run dev find-manager <job-id>
```

### Generate LinkedIn Message

```bash
npm run dev linkedin-message <job-id>
```

### Generate Email

```bash
npm run dev email <job-id>
```

### Full Application Workflow

```bash
npm run dev apply <job-url>
```

### View Application Status

```bash
npm run dev status
```

### Research a Company

```bash
npm run dev research "Company Name"
```

### Check API Credits

```bash
npm run dev credits
```

## Project Structure

```
resume-agent/
├── src/
│   ├── agents/           # AI agents for different tasks
│   │   ├── base-agent.ts
│   │   ├── resume-tailor.agent.ts
│   │   ├── job-analyzer.ts
│   │   ├── cover-letter-generator.ts
│   │   ├── linkedin-message-generator.ts
│   │   ├── email-agent.ts
│   │   ├── company-researcher.agent.ts
│   │   ├── hiring-manager-finder.ts
│   │   └── application-orchestrator.agent.ts
│   ├── services/        # Core services
│   │   ├── llm.service.ts          # Multi-provider LLM
│   │   ├── embeddings.service.ts   # Vector embeddings
│   │   ├── web-scraper.service.ts  # Job posting scraping
│   │   ├── resume-parser.service.ts
│   │   ├── pdf-parser.service.ts
│   │   ├── docx-parser.service.ts
│   │   ├── document-generator.service.ts
│   │   ├── export.service.ts
│   │   ├── github.service.ts
│   │   ├── github-skills.service.ts
│   │   ├── hunter.service.ts
│   │   ├── apollo.service.ts
│   │   └── rocketreach.service.ts
│   ├── database/        # Database client and repositories
│   ├── cli/             # CLI commands
│   ├── orchestrator/    # Workflow orchestration
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript type definitions
│   ├── config/          # Configuration
│   └── templates/       # Document templates
├── data/
│   ├── resumes/         # Master resume data
│   ├── outputs/         # Generated resumes and cover letters
│   ├── cache/           # Cached data
│   └── uploads/         # User uploads
├── prisma/
│   └── schema.prisma    # Database schema
└── tests/               # Test files
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize project |
| `resume` | Manage master resume (add-experience, add-project, etc.) |
| `upload` | Upload a resume file (PDF/DOCX) |
| `analyze` | Analyze a job posting URL |
| `jobs` | List and manage analyzed jobs |
| `tailor` | Tailor resume to a specific job |
| `generate` | Generate DOCX/PDF output |
| `cover-letter` | Generate a cover letter |
| `find-manager` | Find hiring manager for a job |
| `linkedin-message` | Generate LinkedIn outreach message |
| `email` | Generate follow-up email |
| `apply` | Full application workflow |
| `status` | View application status |
| `research` | Research a company |
| `credits` | Check API usage |
| `github` | Sync GitHub repositories |
| `list` | List resources |
| `export` | Export data |
| `import` | Import data |
| `reset` | Reset database |

## Development

### Run in Development Mode

```bash
npm run dev
```

### Run Tests

```bash
npm run test
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

### Lint and Format

```bash
npm run lint
npm run format
```

### Open Prisma Studio

```bash
npm run db:studio
```

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
sudo service postgresql status

# Restart PostgreSQL
sudo service postgresql restart

# Test connection
psql -U resume_user -d resume_agent
```

### Prisma Issues

```bash
# Reset database
npx prisma migrate reset

# Re-generate Prisma client
npx prisma generate

# View database in browser
npx prisma studio
```

### API Key Issues

- Make sure your `.env` file is in the root directory
- Check that API keys don't have extra spaces
- Verify keys are valid in their respective consoles

## Contributing

This is a personal project, but suggestions and feedback are welcome!

## License

MIT

## Acknowledgments

- Built with Claude by Anthropic
- Inspired by modern job search challenges
- Designed for full-stack engineers
