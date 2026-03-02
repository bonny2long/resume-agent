# Resume Agent - Knowledge Transfer

## Project Overview

AI-powered resume tailoring application that helps users land their dream job. Users upload resumes, add their career story, and get personalized applications for every job using AI agents.

## Architecture

### Monorepo Structure

```
resume-agent/
├── packages/
│   ├── client/        # Next.js 14 UI (port 3000)
│   ├── server/        # Fastify API (port 4000)
│   └── shared/       # Prisma client & types
├── prisma/           # Database schema
├── data/             # Uploaded files, outputs
├── docs/             # Documentation
└── scripts/           # Utility scripts
```

### Tech Stack

- **Client**: Next.js 14, TypeScript, Tailwind CSS, React Query
- **Server**: Fastify, TypeScript, JWT auth, Prisma
- **Database**: PostgreSQL
- **AI**: Claude (Anthropic), various LLM providers

---

## Running the Project

### Start Server

```bash
cd packages/server
pnpm dev
# Runs on http://localhost:4000
```

### Start Client

```bash
cd packages/client
pnpm dev
# Runs on http://localhost:3000
```

### Database

- PostgreSQL at `localhost:5432/resume_agent`
- Credentials in `.env`

---

## What We Built (Completed)

### Phase 1: Monorepo Setup ✅

- Created pnpm workspaces structure
- Set up packages: client, server, shared
- Configured Turborepo
- Moved data folder to root

### Phase 2: Database Schema ✅

- Added User, Account, Session tables
- Added UserStory, UserAchievementStory tables
- Added UserVoiceProfile, UserSettings tables
- Linked MasterResume to User via userId

### Phase 3: Server API ✅

- Auth routes (register, login, me)
- Resume CRUD endpoints
- Resume upload with AI parsing
- Story endpoints
- Dev mode bypass (use `Bearer dev-token`)

### Phase 4: Client Auth Pages ✅

- NextAuth setup with credentials provider
- Login page (/auth/login)
- Register page (/auth/register)
- Dashboard layout with sidebar
- Dev mode (no auth required)

### Phase 5: Resume Bank UI ✅

- Upload page with drag-drop
- Resume list page (grid view)
- Resume detail/edit page
- Tabs for: Details, Experience, Projects, Skills, Education

### Resume Parser (In Progress ⚠️)

- Located at: `packages/server/src/parser.ts`
- Uses AI (Claude Sonnet) first
- Falls back to regex patterns
- Has 80+ skills dictionary
- **ISSUE**: Sometimes misses experiences/projects/education

---

## Current Status

### Working Features

- ✅ User registration/login (dev mode bypassed)
- ✅ Resume upload with AI parsing
- ✅ Resume bank (list, view)
- ✅ Resume detail/edit page with Raw Data tab
- ✅ Full AI response stored (`resumeData` JSON)
- ✅ Raw text stored for re-parsing
- ✅ Career story management
- ✅ Voice profile management
- ✅ Settings page (API keys, preferences)
- ✅ Tailor resume to job (AI-powered)
- ✅ Cover letter generator (AI-powered)
- ✅ Applications tracking page
- ✅ Dashboard with stats and quick actions

### Data Storage (Option B)

Now storing full resume data for agents:
- `rawText` - Original extracted text from PDF/DOCX
- `resumeData` - Full AI JSON response (all sections including partial)
- `jobDescription` - Job description for tailored resumes
- `tailoredFromId` - Link to master resume

### Known Issues

- Parser: AI can still miss some sections - but data is preserved in resumeData
- Server TypeScript: Some pre-existing config issues (not blocking)

---

## What We Built (March 2026)

### Phase 1: Data Foundation ✅
- Added `resumeData` JSON + `rawText` to MasterResume schema
- Updated parser to return full AI response
- Updated server to store complete data

### Phase 2: Stories & Settings ✅
- `/dashboard/stories` - Career story, achievements, voice profile
- `/dashboard/settings` - API keys, feature toggles
- API endpoints for all story types

### Phase 3: Tailor Workflow ✅
- `POST /api/resumes/:id/tailor` - AI-powered resume tailoring
- `/dashboard/tailor` - UI for tailoring workflow

### Phase 4: Cover Letters ✅
- `POST /api/cover-letter` - AI cover letter generation
- `/dashboard/cover-letter` - UI with preview & copy

### Phase 5: Dashboard & Tracking ✅
- Improved dashboard with stats and quick actions
- `/dashboard/applications` - Track job applications
- Organized sidebar navigation

---

## API Endpoints

- Generate cover letters using AI
- Based on user's story + job description

### Priority 5: Settings Page

- User preferences
- API key management
- LLM provider selection

---

## API Endpoints

### Auth

- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Resumes

- `GET /api/resumes` - List user's resumes
- `GET /api/resumes/:id` - Get single resume
- `POST /api/resumes` - Create resume
- `PUT /api/resumes/:id` - Update resume
- `DELETE /api/resumes/:id` - Delete resume
- `POST /api/resumes/upload` - Upload & parse resume

### Stories

- `GET /api/stories` - Get user's stories
- `POST /api/stories/career` - Save career story

---

## UI Pages (Routes)

| Route                       | Page                | Status |
| --------------------------- | ------------------- | ------ |
| `/`                         | Landing            | ✅     |
| `/auth/login`               | Login              | ✅     |
| `/auth/register`            | Register           | ✅     |
| `/dashboard`                | Dashboard          | ✅     |
| `/dashboard/upload`         | Upload             | ✅     |
| `/dashboard/resumes`        | Resume List        | ✅     |
| `/dashboard/resumes/[id]`   | Resume Detail      | ✅     |
| `/dashboard/stories`       | Stories            | ✅     |
| `/dashboard/settings`      | Settings           | ✅     |
| `/dashboard/tailor`        | Tailor Resume      | ✅     |
| `/dashboard/cover-letter`  | Cover Letter       | ✅     |
| `/dashboard/applications`  | Applications       | ✅     |

---

## API Endpoints

### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Resumes
- `GET /api/resumes` - List user's resumes
- `GET /api/resumes/:id` - Get single resume
- `POST /api/resumes` - Create resume
- `PUT /api/resumes/:id` - Update resume
- `DELETE /api/resumes/:id` - Delete resume
- `POST /api/resumes/upload` - Upload & parse resume
- `POST /api/resumes/:id/tailor` - Tailor resume to job
- `GET /api/resumes/:id/tailored` - Get tailored versions

### Cover Letter
- `POST /api/cover-letter` - Generate cover letter

### Stories
- `GET /api/stories` - Get user's stories
- `POST /api/stories/career` - Save career story
- `POST /api/stories/voice` - Save voice profile

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings

### Applications
- `GET /api/applications` - List applications
- `POST /api/applications` - Track application

---

## Key Files

| File                                 | Purpose                       |
| ------------------------------------ | ----------------------------- |
| `packages/server/src/index.ts`       | Main Fastify server           |
| `packages/server/src/parser.ts`      | Resume parser (AI + patterns) |
| `packages/client/src/app/dashboard/` | Dashboard pages               |
| `packages/shared/schema.prisma`      | Database schema               |
| `.env`                               | API keys, database URL        |

---

## Database Schema

### User Tables (New)

```prisma
User
Account
Session
UserStory
UserAchievementStory
UserVoiceProfile
UserSettings
```

### Existing Tables (linked to User)

```prisma
MasterResume (userId)
Experience (resumeId)
Project (resumeId)
Skill (resumeId)
Education (resumeId)
Certification (resumeId)
```

---

## Environment Variables

```env
# Server
PORT=4000
JWT_SECRET=dev-secret-change-in-production

# Database
DATABASE_URL=postgresql://resume_user:pass@localhost:5432/resume_agent

# AI Providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
COHERE_API_KEY=...
GEMINI_API_KEY=...

# Client
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## Development Notes

### Dev Mode Bypass

Server accepts `Authorization: Bearer dev-token` for testing without login. This auto-creates/finds a dev user in the database.

### Testing Upload

1. Start server: `cd packages/server && pnpm dev`
2. Start client: `cd packages/client && pnpm dev`
3. Go to http://localhost:3000/dashboard/upload
4. Upload a PDF resume

### Database Changes

1. Edit `packages/shared/schema.prisma`
2. Copy to `prisma/schema.prisma`
3. Run `cd packages/shared && pnpm prisma generate`
4. Run `cd packages/shared && pnpm prisma db push`

---

## Next Steps

1. **Fix Parser** → Make it extract experiences/projects/education reliably
2. **Stories UI** → Add career story management
3. **Agent** → Integrate AI agents for tailoring
4. **Cover Letters** → Generate cover letters
5. **Settings** → API keys, preferences

---

_Last updated: March 2026_
