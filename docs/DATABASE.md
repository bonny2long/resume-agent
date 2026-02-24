# Database Schema

Resume Agent uses PostgreSQL with pgvector for vector embeddings.

## Schema Overview

### Core Resume Models

#### MasterResume
Your master resume data - the source of truth for all applications.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| fullName | String | Full name |
| email | String | Email address |
| phone | String | Phone number |
| location | String | City, State |
| linkedInUrl | String? | LinkedIn profile |
| githubUrl | String? | GitHub profile |
| portfolioUrl | String? | Portfolio website |
| summaryShort | String | Short summary |
| summaryLong | String | Long summary |

#### Experience
Work experience entries.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| resumeId | UUID | Foreign key to MasterResume |
| company | String | Company name |
| title | String | Job title |
| location | String | Job location |
| startDate | DateTime | Start date |
| endDate | DateTime? | End date (null if current) |
| current | Boolean | Currently working here |
| description | String? | Job description |
| embedding | Float[] | Vector embedding for RAG |

#### Achievement
Notable achievements within an experience.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| experienceId | UUID | Foreign key to Experience |
| description | String | Achievement description |
| metrics | String? | Quantified metrics |
| keywords | String[] | Related keywords |
| impact | Enum | high, medium, low |

#### Project
Portfolio projects.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| resumeId | UUID | Foreign key to MasterResume |
| name | String | Project name |
| description | String | Project description |
| role | String | Your role |
| githubUrl | String? | GitHub link |
| liveUrl | String? | Live demo link |
| achievements | String[] | Key achievements |
| embedding | Float[] | Vector embedding |

#### Skill
Resume skills.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| resumeId | UUID | Foreign key to MasterResume |
| name | String | Skill name |
| category | String | technical, soft |
| proficiency | Enum | beginner, intermediate, advanced, expert |

#### Education
Education history.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| resumeId | UUID | Foreign key to MasterResume |
| institution | String | School name |
| degree | String | Degree type |
| field | String | Field of study |
| startDate | DateTime | Start date |
| endDate | DateTime? | End date |
| gpa | String? | GPA |

---

## Job & Application Models

#### Company
Companies you've applied to.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Company name |
| domain | String? | Website domain |
| industry | String? | Industry |
| size | String? | Company size |
| headquarters | String? | Location |
| values | String[] | Company values |
| benefits | String[] | Benefits |
| techStack | String[] | Tech stack |
| recentNews | JSON? | Recent news |

#### Job
Job postings.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| companyId | UUID | Foreign key to Company |
| title | String | Job title |
| url | String? | Job posting URL |
| location | String | Job location |
| salary | String? | Salary range |
| requiredSkills | String[] | Required skills |
| preferredSkills | String[] | Preferred skills |
| responsibilities | String[] | Job responsibilities |
| qualifications | String[] | Required qualifications |
| keywords | String[] | Extracted keywords |
| experienceLevel | String? | Entry, mid, senior |

#### Application
Job applications.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| jobId | UUID | Foreign key to Job |
| status | String | prepared, applied, interview, offer, rejected |
| appliedAt | DateTime? | When applied |
| resumePath | String? | Path to tailored resume |
| coverLetterPath | String? | Path to cover letter |
| linkedInSent | Boolean | LinkedIn message sent? |
| interviewDate | DateTime? | Interview scheduled |
| notes | String? | Application notes |

---

## Hiring Manager Models

#### HiringManager
Potential hiring managers.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| jobId | UUID | Foreign key to Job |
| name | String | Manager name |
| title | String | Job title |
| department | String? | Department |
| linkedInUrl | String? | LinkedIn profile |
| email | String? | Email address |
| confidence | Int | Match confidence (0-100) |
| verified | Boolean | Verified contact? |

#### LinkedInMessage
Generated LinkedIn messages.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| hiringManagerId | UUID | Foreign key to HiringManager |
| type | String | connection_request, follow_up |
| body | String | Message content |
| characterCount | Int | LinkedIn character count |
| tone | String | Message tone |
| status | String | draft, sent, responded |

#### EmailMessage
Generated emails.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| applicationId | UUID? | Foreign key to Application |
| hiringManagerId | UUID? | Foreign key to HiringManager |
| type | String | initial_followup, post_interview, check_in |
| to | String | Recipient email |
| subject | String | Email subject |
| body | String | Email body |
| tone | String | Email tone |
| status | String | draft, sent, responded |

---

## Enhanced Pipeline Models

#### QuantifiedAchievement
McKinsey-style quantified achievements.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| resumeId | UUID | Foreign key to MasterResume |
| experienceId | UUID? | Optional link to Experience |
| originalText | String | Original achievement |
| rewrittenText | String | Quantified version |
| category | String? | leadership, technical, etc. |
| revenueImpact | String? | Revenue metrics |
| scaleMetrics | String? | Scale/scope metrics |
| timeImprovement | String? | Time saved |
| percentageGain | String? | % improvement |

#### EnhancedSummary
Harvard-style summaries.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| resumeId | UUID | Foreign key to MasterResume |
| jobId | UUID? | Optional link to Job |
| angle | String | leadership, technical, results, industry, vision |
| summary | String | Summary text |
| recommended | Boolean | Recommended version? |
| atsKeywords | String[] | Keywords for ATS |

#### ATSAnalysis
Google ATS optimization results.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| resumeId | UUID | Foreign key to MasterResume |
| jobId | UUID? | Optional link to Job |
| overallScore | Int | Overall ATS score (0-100) |
| atsMatchScore | Int | Keyword match score |
| summaryScore | Int | Summary score |
| experienceScore | Int | Experience relevance |
| skillsScore | Int | Skills match |
| keywordAnalysis | JSON? | Detailed keyword analysis |
| recommendations | String[] | Improvement suggestions |

#### STARStory
FAANG-style interview stories.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| resumeId | UUID | Foreign key to MasterResume |
| title | String | Story title |
| category | String | leadership, conflict, failure, etc. |
| situation | String | S in STAR |
| task | String | T in STAR |
| action | String | A in STAR |
| result | String | R in STAR |
| metrics | String? | Quantified results |
| lessons | String? | Lessons learned |
| targetRole | String? | Target role |

---

## Viewing Your Database

### Prisma Studio
```bash
npm run db:studio
```

This opens a web interface to browse and edit your data.

### psql
```bash
psql -U resume_user -d resume_agent

# List tables
\dt

# Query examples
SELECT * FROM "master_resumes";
SELECT * FROM "quantified_achievements";
SELECT * FROM "enhanced_summaries";
```

---

## Migrations

### Create New Migration
```bash
npx prisma migrate dev --name migration_name
```

### Reset Database
```bash
npm run reset
```

### Generate Prisma Client
```bash
npx prisma generate
```
