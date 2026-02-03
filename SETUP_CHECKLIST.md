# Setup Checklist ✓

Use this checklist to track your setup progress.

## Prerequisites

- [ ] Node.js 18+ installed (`node -v`)
- [ ] PostgreSQL 8.0+ installed and running
- [ ] Git installed (optional)

## Installation

- [ ] Cloned/downloaded the project
- [ ] Ran `npm install` successfully
- [ ] No errors in npm install

## Database Setup

- [ ] PostgreSQL service is running
- [ ] Created database `resume_agent`
- [ ] Created user `resume_user` with password
- [ ] Granted privileges to user
- [ ] Installed pgvector extension
- [ ] Can connect: `psql -U resume_user -d resume_agent`

## Environment Configuration

- [ ] Copied `.env.example` to `.env`
- [ ] Updated DATABASE_URL with correct credentials
- [ ] Got Anthropic API key from console.anthropic.com
- [ ] Added ANTHROPIC_API_KEY to `.env`
- [ ] (Optional) Got GitHub token from github.com/settings/tokens
- [ ] (Optional) Added GITHUB_TOKEN to `.env`

## Database Migrations

- [ ] Ran `npx prisma migrate dev --name init`
- [ ] No errors in migration
- [ ] Ran `npx prisma generate`
- [ ] Prisma client generated successfully

## Directory Setup

- [ ] Created `data/outputs` directory
- [ ] Created `data/cache` directory
- [ ] Created `data/uploads` directory

## Build & Test

- [ ] Ran `npm run build` (or at least `npm run dev` works)
- [ ] CLI shows banner when running `npm run dev`
- [ ] No configuration errors on startup
- [ ] Database connects successfully

## First Run

- [ ] Ran `npm run dev init`
- [ ] Filled in personal information
- [ ] Master resume created in database
- [ ] Can view resume in `npx prisma studio`

## Optional Verification

- [ ] Can open Prisma Studio: `npx prisma studio`
- [ ] Can see master_resumes table in Studio
- [ ] Your resume data appears correctly
- [ ] No errors in console

## API Key Verification

You can verify your API keys are working:

### Anthropic API Key

- [ ] Logged in to console.anthropic.com
- [ ] Key shows as active
- [ ] Key starts with `sk-ant-api03-`

### GitHub Token (if using)

- [ ] Token has `repo` and `read:user` scopes
- [ ] Token is not expired
- [ ] Can access: `curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user`

## Troubleshooting Checklist

If something isn't working:

- [ ] Checked PostgreSQL is running: `sudo service postgresql status`
- [ ] Verified database exists: `psql -l | grep resume_agent`
- [ ] Checked .env file exists and has no syntax errors
- [ ] Verified API key is correct (no extra spaces)
- [ ] Tried regenerating Prisma client: `npx prisma generate`
- [ ] Checked Node version is 18+: `node -v`
- [ ] Looked at error messages in console
- [ ] Checked SETUP_GUIDE.md for specific issue

## Ready to Code!

Once all items are checked:

- [ ] Master resume initialized
- [ ] Ready to add experiences
- [ ] Ready to start Week 2 implementation

---

## Quick Reference Commands

\`\`\`bash

# Start the app

npm run dev

# Initialize resume

npm run dev init

# View database

npx prisma studio

# Check database

psql -U resume_user -d resume_agent

# Rebuild if needed

npm run build

# Reset database (careful!)

npx prisma migrate reset
\`\`\`

## Status

**Setup Started**: ****\_\_****

**Setup Completed**: ****\_\_****

**First Resume Created**: ****\_\_****

**Notes**:

---

---

---
