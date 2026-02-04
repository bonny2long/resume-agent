# 📋 Resume Agent CLI Commands Reference

# 📋 Resume Agent CLI Commands Reference

This document provides a comprehensive reference for all available commands in Resume Agent CLI.

## 🚀 Getting Started

```bash
# Show main help
npm run dev -- --help

# Show command-specific help
npm run dev -- <command> --help
```

## 🎯 Command Categories

- **📝 Resume Management** - Add, list, edit, delete resume data
- **🗂️ File Upload** - Upload and parse existing resumes (PDF/DOCX)
- **📊 Data Export** - Export master resume data in various formats
- **🤖 Job Application** - Apply for jobs and track applications
- **🔍 Company Research** - Research companies and find hiring managers
- **🐙 GitHub Integration** - Sync repositories and manage project data
- **🔄 Database Management** - Reset and manage database
- **⚙️ Utility** - System status, API credits, and configuration

---

## 📝 Resume Management Commands

### `resume` - Manage your master resume

#### Add Work Experience

```bash
npm run dev -- resume add-experience
# Alias: npm run dev -- resume add-exp
```

**Features:**

- Interactive prompts for company, title, location, dates
- Add multiple achievements with metrics and impact levels
- Select technologies from common list or add custom ones
- Support for current positions

**Example Flow:**

1. Company name: Google
2. Job title: Senior Software Engineer
3. Location: Mountain View, CA
4. Start date: 2020-01-15
5. Current position: Yes
6. Job description: Leading development of...
7. Add achievements with metrics (40% user engagement increase)
8. Select technologies (React, Node.js, PostgreSQL)

---

#### Add Project

```bash
npm run dev -- resume add-project
```

**Features:**

- Project name, description, and your role
- Project timeline (start/end dates)
- Multiple achievements with impact metrics
- Technologies used
- Project URL and GitHub link integration

---

#### Add Skill

```bash
npm run dev -- resume add-skill
```

**Features:**

- Skill name and categorization
- Proficiency levels (Beginner → Expert)
- Years of experience tracking
- Categories: Programming Languages, Frontend, Backend, Database, Cloud & DevOps, Mobile, AI/ML, Testing, Tools & Others

---

#### Add Education

```bash
npm run dev -- resume add-education
```

**Features:**

- Institution, degree, and field of study
- Education timeline
- GPA tracking
- Support for current students

---

#### List All Resume Data

```bash
npm run dev -- resume list
```

**Displays:**

- Personal information summary
- Experiences with achievement counts
- Projects with role and tech stack
- Skills categorized by type
- Education history
- Overall statistics

---

#### Edit Entry

```bash
npm run dev -- resume edit <type> <id>
```

**Types:** `experience`, `exp`, `project`, `skill`, `education`, `edu`
**Note:** Full editing functionality coming soon - currently displays current data

---

#### Delete Entry

```bash
npm run dev -- resume delete <type> <id>
# Alias: npm run dev -- resume rm <type> <id>
```

**Types:** `experience`, `exp`, `project`, `skill`, `education`, `edu`
**Note:** Confirmation dialog coming soon

---

#### Export Resume Data

```bash
npm run dev -- resume export
```

**Coming in Week 2:** JSON export functionality

---

## 🐙 GitHub Integration Commands

### `github` - GitHub repository management

#### Sync Repositories

```bash
npm run dev -- github sync
```

**Features:**

- Fetches all your GitHub repositories
- Extracts languages, topics, stars, forks
- Downloads README content
- Stores in database for resume enhancement
- Handles private repos (with proper token)

**Requirements:**

- `GITHUB_TOKEN` environment variable set
- Token scopes: `repo`, `read:user`

---

#### List Repositories

```bash
npm run dev -- github list
# With options
npm run dev -- github list --featured    # Show only featured repos
npm run dev -- github list --limit 10     # Limit to 10 repos
```

**Displays:**

- Repository name and description
- Stars and forks count
- Languages and topics
- Last updated date
- Repository URL

---

#### Show Repository Details

```bash
npm run dev -- github show <repository-name>
```

**Features:**

- Full repository information
- Language breakdown
- Topics/tags
- README preview (first 10 lines)
- Creation and last commit dates

---

## 📤 File Upload Commands

### Upload Single Resume

```bash
npm run dev -- upload <file-path>
```

**Supported Formats:** PDF, DOCX
**Features:**

- Parse resume content automatically
- Extract personal info, experience, projects, skills, education
- Create master resume entry in database

---

### Upload Multiple Resumes

```bash
npm run dev -- upload-all
# With options
npm run dev -- upload-all --force    # Re-upload all files
```

**Features:**

- Process all files in `data/resumes/` directory
- Batch upload and parsing
- Progress tracking

---

## 📊 Export Commands

### Export Data

```bash
npm run dev -- export --format <format> --type <type>
```

**Formats:** `json`
**Types:** `master`, `github`
**Examples:**

```bash
npm run dev -- export --format json --type master     # Export master resume
npm run dev -- export --format json --type github     # Export GitHub repos
```

---

## 🔍 Job Application Commands

### Apply for Job

```bash
npm run dev -- apply [job-url]
```

**Coming in Week 3:** Full application workflow

---

### Company Research

```bash
npm run dev -- research [company-name]
```

**Coming in Week 3:** Company analysis and insights

---

### Application Status

```bash
npm run dev -- status
```

**Coming in Week 3:** Track application progress

---

## ⚙️ Initialization Commands

### Initialize Master Resume

```bash
npm run dev -- init
```

**Features:**

- Interactive setup for master resume
- Personal information collection
- Creates database entry

---

## 🔍 Utility Commands

### View API Credits

```bash
npm run dev -- credits
```

**Features:**

- Contact finder API usage
- Remaining credits
- Rate limit information

---

## 🎯 Command Examples by Use Case

### 🏗️ Building Your Resume Database

```bash
# Start with master resume
npm run dev -- init

# Add work experiences
npm run dev -- resume add-experience
npm run dev -- resume add-experience  # Add multiple

# Add projects
npm run dev -- resume add-project

# Add skills by category
npm run dev -- resume add-skill
npm run dev -- resume add-skill
npm run dev -- resume add-skill

# Add education
npm run dev -- resume add-education

# Review everything
npm run dev -- resume list
```

### 🐙 Enhancing with GitHub Data

```bash
# Sync your repositories
npm run dev -- github sync

# See what was synced
npm run dev -- github list

# Check a specific repo
npm run dev -- github show my-awesome-project

# Export GitHub data
npm run dev -- export --format json --type github
```

### 📤 Uploading Existing Resumes

```bash
# Upload single file
npm run dev -- upload ~/Downloads/my-resume.pdf

# Upload all files
npm run dev -- upload-all

# Export parsed data
npm run dev -- export --format json --type master
```

### 📊 Quick Status Check

```bash
# See resume overview
npm run dev -- resume list

# Check GitHub sync status
npm run dev -- github list --limit 5

# Check API usage
npm run dev -- credits
```

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in your project root:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/resume_agent"

# Required APIs
ANTHROPIC_API_KEY="your-anthropic-key"

# Optional (for GitHub sync)
GITHUB_TOKEN="ghp_your-github-token"

# Optional (for contact finding)
ROCKETREACH_API_KEY="your-rocketreach-key"
HUNTER_API_KEY="your-hunter-key"
APOLLO_API_KEY="your-apollo-key"
```

### GitHub Token Setup

1. Go to: https://github.com/settings/tokens
2. Generate new token (classic)
3. Select scopes: `repo`, `read:user`
4. Add to `.env` as `GITHUB_TOKEN=your_token`

---

## 📝 Tips & Best Practices

### Resume Management

- **Be Specific**: Use concrete metrics in achievements (e.g., "Increased performance by 40%")
- **Impact Levels**: Use `high` for business impact, `medium` for significant contributions, `low` for improvements
- **Current Positions**: Leave end date empty for current roles
- **Tech Stack**: Include all relevant technologies - this helps with job matching

### GitHub Integration

- **Regular Sync**: Run `github sync` periodically to keep repository data fresh
- **Featured Repos**: Use the `--featured` flag to highlight your best work
- **README Content**: Keep READMEs updated as they're used for project descriptions

## 🔄 **Database Reset Commands**

### Reset Database

```bash
npm run dev -- reset [options]
```

**Options:**

- `--type <type>`: What to reset (`all`, `resume`, `data`)
- `--confirm`: Skip confirmation prompt

**Reset Types:**

- `all`: Delete ALL data (resumes, jobs, applications, etc.)
- `resume`: Delete only resume data (master resumes, experiences, projects, skills, education, certifications)
- `data`: Delete job application data (jobs, companies, hiring managers, LinkedIn messages)

**Examples:**

```bash
# Reset all data with confirmation
npm run dev -- reset --type all

# Reset only resume data
npm run dev -- reset --type resume --confirm

# Quick reset before re-uploading
npm run dev -- reset --type resume --confirm
```

### Data Management

- **Backup Data**: Regularly export your master resume data
- **Review Before Delete**: Always check `resume list` before making deletions
- **Incremental Building**: Add experiences and projects as you complete them

---

## 🐛 Troubleshooting

### Common Issues

**"No master resume found"**

```bash
# Solution: Create master resume first
npm run dev -- init
```

**"GITHUB_TOKEN required"**

```bash
# Solution: Set up GitHub token
# 1. Go to https://github.com/settings/tokens
# 2. Generate token with repo, read:user scopes
# 3. Add to .env file
```

**Database connection errors**

```bash
# Solution: Check database is running and URL is correct
# Verify DATABASE_URL in .env
# Test connection: npx prisma studio
```

**File upload errors**

```bash
# Solution: Check file format and path
# Supported: PDF, DOCX
# Ensure files exist and are readable
```

---

## 📚 Next Development Phases

### Week 3 - Job Analysis & Matching

- `apply` command implementation
- Job posting parsing
- Skills matching algorithms
- Resume tailoring engine

### Week 4 - Resume Generation

- Tailored resume creation
- Multiple resume formats
- ATS optimization
- Keyword optimization

### Week 5 - Cover Letters & Outreach

- Cover letter generation
- LinkedIn message creation
- Hiring manager research
- Personalization engine

### Week 6 - Application Management

- Application tracking
- Status monitoring
- Follow-up reminders
- Success analytics

---

## 🆘 Getting Help

### Command Help

```bash
# Main help
npm run dev -- --help

# Command-specific help
npm run dev -- resume --help
npm run dev -- github --help
npm run dev -- upload --help
```

### Check System Status

```bash
# Database connection
npx prisma studio

# Environment variables
cat .env

# Installation status
npm run build
```

### Log Files

Check logs in the console output for detailed error messages and debugging information.

---

_This command reference is for Resume Agent v1.0.0. Last updated: Week 2 Implementation Phase_
