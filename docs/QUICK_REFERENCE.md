# Quick Reference Card 📋

## Essential Commands

### Setup & Installation

```bash
# Install dependencies
npm install

# Set up database
npx prisma migrate dev --name init
npx prisma generate

# Create data directories
mkdir -p data/{outputs,cache,uploads}
```

### Running the Application

```bash
# Development mode (with auto-reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

### CLI Commands (Available Now)

```bash
# Show help
npm run dev --help

# Initialize master resume
npm run dev init
```

### CLI Commands (Coming Soon)

```bash
# Resume management
npm run dev resume add-experience
npm run dev resume add-project
npm run dev resume add-skill
npm run dev resume list

# GitHub sync
npm run dev github sync

# Job application
npm run dev apply <job-url>

# Company research
npm run dev research "Company Name"

# Application status
npm run dev status
```

---

## Database Commands

### Prisma

```bash
# Open database GUI
npx prisma studio

# Create migration
npx prisma migrate dev --name <name>

# Generate Prisma client
npx prisma generate

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Push schema without migration
npx prisma db push

# View all migrations
npx prisma migrate status
```

### PostgreSQL Direct

```bash
# Connect to database
psql -U resume_user -d resume_agent

# List databases
psql -l

# Check PostgreSQL status
sudo service postgresql status

# Start PostgreSQL
sudo service postgresql start

# Restart PostgreSQL
sudo service postgresql restart
```

---

## Development Workflow

### Daily Development

```bash
# 1. Pull latest changes (if using git)
git pull

# 2. Install any new dependencies
npm install

# 3. Run database migrations
npx prisma migrate dev

# 4. Start development
npm run dev
```

### Adding New Features

```bash
# 1. Create new file in appropriate directory
touch src/agents/new-agent.ts

# 2. Update types if needed
# Edit src/types/

# 3. Test your changes
npm run dev

# 4. Build to check for errors
npm run build
```

### Database Changes

```bash
# 1. Edit prisma/schema.prisma

# 2. Create migration
npx prisma migrate dev --name add_new_table

# 3. Regenerate client
npx prisma generate
```

---

## Troubleshooting Commands

### When Things Break

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Regenerate Prisma
npx prisma generate

# Reset database (nuclear option)
npx prisma migrate reset

# Check for TypeScript errors
npx tsc --noEmit

# View logs
npm run dev 2>&1 | tee debug.log
```

### Database Issues

```bash
# Check if PostgreSQL is running
ps aux | grep postgres

# Check database exists
psql -l | grep resume_agent

# Check user can connect
psql -U resume_user -d resume_agent -c "SELECT 1;"

# View tables
psql -U resume_user -d resume_agent -c "\dt"

# Check pgvector installed
psql -U resume_user -d resume_agent -c "\dx"
```

---

## API Key Management

### Getting Keys

**Anthropic (Required)**

```
1. Visit: https://console.anthropic.com/settings/keys
2. Create new key
3. Add to .env: ANTHROPIC_API_KEY="sk-ant-api03-..."
```

**GitHub (Optional)**

```
1. Visit: https://github.com/settings/tokens
2. Generate new token (classic)
3. Scopes: repo, read:user
4. Add to .env: GITHUB_TOKEN="ghp_..."
```

### Testing Keys

```bash
# Test Anthropic key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'

# Test GitHub token
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user
```

---

## File Locations

### Important Paths

```
resume-agent/
├── .env                    # Your API keys (DO NOT commit!)
├── data/
│   ├── outputs/           # Generated resumes & cover letters
│   ├── cache/             # Cached API responses
│   └── uploads/           # User uploads
├── prisma/
│   └── migrations/        # Database migrations
└── src/                   # Source code
```

### Generated Files

```
dist/                      # Compiled JavaScript (after build)
node_modules/              # Dependencies
.env                       # Environment variables (git ignored)
```

---

## NPM Scripts

```bash
# Development
npm run dev                # Run with ts-node (dev mode)
npm run build              # Compile TypeScript to JavaScript
npm start                  # Run compiled version

# Database
npm run db:migrate         # Run migrations
npm run db:generate        # Generate Prisma client
npm run db:studio          # Open Prisma Studio
npm run db:seed            # Seed database (once implemented)
npm run db:reset           # Reset database

# Code Quality (once set up)
npm run lint               # Run ESLint
npm run format             # Format with Prettier
npm test                   # Run tests
npm run test:watch         # Watch mode for tests
```

---

## Environment Variables

### Required

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/resume_agent"
ANTHROPIC_API_KEY="sk-ant-api03-..."
```

### Optional

```env
GITHUB_TOKEN="ghp_..."
OPENAI_API_KEY="sk-..."
LOG_LEVEL="info"          # debug|info|warn|error
NODE_ENV="development"     # development|production
```

---

## Common Patterns

### Creating a New Agent

```typescript
// src/agents/new-agent.ts
import { getLLMService } from "@/services/llm.service";
import { logger } from "@/utils/logger";

export class NewAgent {
  private llm = getLLMService();

  async process(input: string): Promise<string> {
    logger.info("Processing input");
    const result = await this.llm.complete(input);
    return result.data || "";
  }
}
```

### Adding a New CLI Command

```typescript
// src/cli/commands/new-command.ts
import { Command } from "commander";
import { logger } from "@/utils/logger";

export const newCommand = new Command("new")
  .description("Description of command")
  .argument("[param]", "Parameter description")
  .action(async (param?: string) => {
    logger.header("New Command");
    // Implementation
  });

// Then in src/cli/index.ts:
import { newCommand } from "./commands/new-command";
program.addCommand(newCommand);
```

---

## Keyboard Shortcuts

### In CLI (inquirer prompts)

- `↑/↓` - Navigate options
- `Space` - Select (checkbox)
- `Enter` - Confirm
- `Ctrl+C` - Cancel
- `Tab` - Autocomplete (when available)

### In Prisma Studio

- `Ctrl+K` - Command palette
- `Ctrl+F` - Search
- `Ctrl+S` - Save changes

---

## Quick Links

- [Anthropic Console](https://console.anthropic.com/)
- [GitHub Tokens](https://github.com/settings/tokens)
- [Prisma Docs](https://www.prisma.io/docs)
- [Commander.js Docs](https://github.com/tj/commander.js)

---

## Status Indicators

✅ = Working
🚧 = In Progress
📅 = Planned
❌ = Not Working

---

**Last Updated**: Phase 0 Complete
**Current Phase**: Foundation ✅
**Next Phase**: Week 2 - Master Resume Management 📅
