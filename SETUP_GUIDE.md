# Setup Guide 🚀

This guide will walk you through setting up the Resume Agent from scratch.

## Table of Contents

1. [PostgreSQL Setup](#postgresql-setup)
2. [Getting API Keys](#getting-api-keys)
3. [Environment Configuration](#environment-configuration)
4. [Running the Application](#running-the-application)
5. [Testing the Setup](#testing-the-setup)

---

## PostgreSQL Setup

### macOS

#### Option 1: Using Homebrew (Recommended)

\`\`\`bash

# Install PostgreSQL

brew install postgresql@14

# Start PostgreSQL service

brew services start postgresql@14

# Create database and user

psql postgres

# In psql console:

CREATE DATABASE resume_agent;
CREATE USER resume_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE resume_agent TO resume_user;
ALTER DATABASE resume_agent OWNER TO resume_user;
\q
\`\`\`

#### Option 2: Using Postgres.app

1. Download from [postgresapp.com](https://postgresapp.com/)
2. Install and open Postgres.app
3. Click "Initialize" to create a new server
4. Open terminal and run:

\`\`\`bash
psql postgres

# Then run the SQL commands above

\`\`\`

### Windows

#### Using PostgreSQL Installer

1. Download from [postgresql.org/download/windows/](https://www.postgresql.org/download/windows/)
2. Run the installer
3. Set a password for the postgres user
4. Keep the default port (5432)
5. Open pgAdmin or command line:

\`\`\`bash

# Using psql

psql -U postgres

# Run these commands:

CREATE DATABASE resume_agent;
CREATE USER resume_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE resume_agent TO resume_user;
ALTER DATABASE resume_agent OWNER TO resume_user;
\q
\`\`\`

### Linux (Ubuntu/Debian)

\`\`\`bash

# Install PostgreSQL

sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL

sudo service postgresql start

# Create database and user

sudo -u postgres psql

# Run these commands:

CREATE DATABASE resume_agent;
CREATE USER resume_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE resume_agent TO resume_user;
ALTER DATABASE resume_agent OWNER TO resume_user;
\q
\`\`\`

### Install pgvector Extension

After setting up PostgreSQL, install the pgvector extension:

\`\`\`bash

# Option 1: If you have admin access

psql -U postgres -d resume_agent -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Option 2: Inside psql

psql -U resume_user -d resume_agent
CREATE EXTENSION IF NOT EXISTS vector;
\q
\`\`\`

**Note**: If pgvector is not available, you may need to install it:

\`\`\`bash

# macOS

brew install pgvector

# Ubuntu/Debian

sudo apt install postgresql-14-pgvector

# Then restart PostgreSQL and create the extension

\`\`\`

### Verify Database Setup

\`\`\`bash

# Connect to database

psql -U resume_user -d resume_agent

# List extensions

\dx

# Should show 'vector' in the list

# Exit

\q
\`\`\`

---

## Getting API Keys

### 1. Anthropic API Key (REQUIRED)

The Anthropic API key is required for the AI agent to work.

#### Steps:

1. **Go to Anthropic Console**
   - Visit: [console.anthropic.com](https://console.anthropic.com/)
2. **Sign Up / Log In**
   - Create an account if you don't have one
   - Verify your email

3. **Navigate to API Keys**
   - Click on your profile (top right)
   - Select "Settings"
   - Go to "API Keys" tab

4. **Create a New Key**
   - Click "Create Key"
   - Give it a name (e.g., "Resume Agent")
   - Copy the key immediately (you won't see it again!)

5. **Key Format**
   - Should look like: \`sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\`

#### Pricing (as of 2024):

- Claude Sonnet 4.5: $3 per million input tokens, $15 per million output tokens
- You get $5 free credits to start
- Typical resume generation: ~$0.10-0.30 per job application

### 2. GitHub Personal Access Token (OPTIONAL)

Used to sync your GitHub repositories and pull project information.

#### Steps:

1. **Go to GitHub Settings**
   - Visit: [github.com/settings/tokens](https://github.com/settings/tokens)

2. **Generate New Token**
   - Click "Generate new token" → "Generate new token (classic)"

3. **Configure Token**
   - Name: "Resume Agent"
   - Expiration: Choose your preference (90 days, 1 year, or no expiration)
4. **Select Scopes**
   - ✅ **repo** (Full control of private repositories)
     - Needed to read private repos
   - ✅ **read:user** (Read user profile data)
     - Needed to get your profile info

5. **Generate and Copy**
   - Click "Generate token"
   - Copy the token immediately (starts with \`ghp\_\`)
   - Store it securely

#### Why You Need This:

- Automatically pull README and project descriptions
- Get accurate technology stack info
- Include repository stats (stars, forks)
- Generate better project descriptions

### 3. OpenAI API Key (OPTIONAL)

Can be used for generating embeddings (alternative to Anthropic).

#### Steps:

1. **Go to OpenAI Platform**
   - Visit: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

2. **Create API Key**
   - Click "+ Create new secret key"
   - Name it "Resume Agent"
   - Copy the key (starts with \`sk-\`)

#### Pricing:

- text-embedding-3-small: $0.02 per 1M tokens
- Much cheaper than using Claude for embeddings

---

## Environment Configuration

### 1. Create .env File

\`\`\`bash

# Copy the example file

cp .env.example .env
\`\`\`

### 2. Edit .env File

Open \`.env\` in your text editor and fill in your values:

\`\`\`env

# Database Configuration

# Replace 'your_secure_password' with the password you set

DATABASE_URL="postgresql://resume_user:your_secure_password@localhost:5432/resume_agent"

# Anthropic API (REQUIRED)

# Paste your sk-ant-api03-... key here

ANTHROPIC_API_KEY="sk-ant-api03-..."

# OpenAI API (OPTIONAL)

# Only needed if you want to use OpenAI for embeddings

OPENAI_API_KEY=""

# GitHub Personal Access Token (OPTIONAL)

# Paste your ghp\_... token here

GITHUB*TOKEN="ghp*..."

# Optional Third-Party APIs

HUNTER_API_KEY=""
APOLLO_API_KEY=""
ROCKETREACH_API_KEY=""

# Application Settings

NODE_ENV="development"
LOG_LEVEL="info"

# Paths (usually don't need to change)

DATA_DIR="./data"
OUTPUTS_DIR="./data/outputs"
CACHE_DIR="./data/cache"
UPLOADS_DIR="./data/uploads"

# LLM Settings

DEFAULT_MODEL="claude-sonnet-4-20250514"
DEFAULT_MAX_TOKENS="4000"
DEFAULT_TEMPERATURE="0.7"

# Feature Flags

ENABLE_WEB_SCRAPING="true"
ENABLE_GITHUB_SYNC="true"
ENABLE_LINKEDIN_SEARCH="false"
\`\`\`

### 3. Security Notes

**IMPORTANT**:

- Never commit your \`.env\` file to Git
- Keep your API keys secret
- Don't share your \`.env\` file
- The \`.gitignore\` file is already configured to ignore \`.env\`

---

## Running the Application

### 1. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 2. Run Database Migrations

\`\`\`bash

# This creates all the tables in your database

npx prisma migrate dev --name init

# This generates the Prisma client

npx prisma generate
\`\`\`

You should see output like:
\`\`\`
✔ Generated Prisma Client
✔ Applied migration 20240115_init
\`\`\`

### 4. Run the Application

### 3. Create Data Directories

\`\`\`bash
mkdir -p data/outputs
mkdir -p data/cache
mkdir -p data/uploads
\`\`\`

### 4. Run the Application

\`\`\`bash

# Development mode (with hot reload)

npm run dev

# Or build and run

npm run build
npm start
\`\`\`

---

## Testing the Setup

### 1. Verify Database Connection

\`\`\`bash

# Open Prisma Studio to view your database

npx prisma studio
\`\`\`

This should open [http://localhost:5555](http://localhost:5555) in your browser.

### 2. Test the CLI

\`\`\`bash

# Should show help menu

npm run dev --help

# Should show version

npm run dev --version

# Initialize your resume

npm run dev init
\`\`\`

### 3. Verify API Keys

The application will validate your API keys on startup. If there are issues, you'll see:

\`\`\`
❌ Configuration errors:
• ANTHROPIC_API_KEY is required
\`\`\`

### 4. Test LLM Service

Once you've initialized your resume, the LLM service will be tested automatically.

---

## Common Issues

### Issue: "Cannot connect to database"

**Solution**:
\`\`\`bash

# Check if PostgreSQL is running

sudo service postgresql status

# Restart it

sudo service postgresql restart

# Test connection manually

psql -U resume_user -d resume_agent
\`\`\`

### Issue: "Extension vector does not exist"

**Solution**:
\`\`\`bash

# Install pgvector

# macOS:

brew install pgvector

# Linux:

sudo apt install postgresql-14-pgvector

# Then create extension:

psql -U postgres -d resume_agent -c "CREATE EXTENSION vector;"
\`\`\`

### Issue: "Prisma Client did not initialize"

**Solution**:
\`\`\`bash

# Regenerate Prisma client

npx prisma generate

# If that doesn't work, reset:

rm -rf node_modules
npm install
npx prisma generate
\`\`\`

### Issue: "Invalid API key"

**Solution**:

- Double-check your API key in \`.env\`
- Make sure there are no extra spaces
- Verify the key is active in the Anthropic console
- Try generating a new key

---

## Next Steps

Once everything is set up:

1. ✅ Run \`npm run dev init\` to create your master resume
2. ✅ Add your work experience
3. ✅ Add your projects
4. ✅ Sync your GitHub repos
5. ✅ Try applying for a job!

---

## Need Help?

If you run into issues:

1. Check the logs in your console
2. Verify all environment variables are set correctly
3. Make sure PostgreSQL is running
4. Check that pgvector extension is installed
5. Ensure API keys are valid

**Happy job hunting! 🚀**
