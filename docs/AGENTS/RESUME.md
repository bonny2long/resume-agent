# Resume Enhancement Agents

Agents focused on optimizing your resume for maximum impact.

## Achievement Quantifier (McKinsey & Co)

**File**: `src/agents/resume/achievement-quantifier.agent.ts`

**Inspiration**: McKinsey & Company consultants are known for quantifying impact with precise metrics.

### What It Does
Rewrites resume achievements to include:
- **Revenue Impact**: Dollar amounts and business value
- **Scale Metrics**: Team sizes, project scope, user counts
- **Time Improvements**: Efficiency gains, time saved
- **Percentage Gains**: Performance improvements

### CLI Command
```bash
npm run dev -- enhance quantify
```

### Database Storage
- Table: `QuantifiedAchievement`
- Fields: originalText, rewrittenText, category, revenueImpact, scaleMetrics, timeImprovement, percentageGain

---

## Harvard Summary Writer (Harvard Business School)

**File**: `src/agents/resume/harvard-summary.agent.ts`

**Inspiration**: Harvard Business School resume summaries are concise, impactful, and position candidates as leaders.

### What It Does
Generates 5 different summary versions:
1. **Leadership Angle** - Emphasizes team leadership and management
2. **Technical Angle** - Focuses on technical expertise
3. **Results Angle** - Highlights measurable achievements
4. **Industry Angle** - Connects to industry-specific experience
5. **Vision Angle** - Shows future potential and goals

### CLI Command
```bash
npm run dev -- enhance summary <job-id>
```

### Database Storage
- Table: `EnhancedSummary`
- Fields: angle, summary, recommended, atsKeywords

### Usage in Resume
The Resume Tailor agent automatically retrieves Harvard summaries from the database when available.

---

## ATS Optimizer (Google)

**File**: `src/agents/resume/ats-optimizer.agent.ts`

**Inspiration**: Google was one of the first companies to use sophisticated ATS analysis.

### What It Does
- Analyzes resume against job description
- Scores keyword match percentage
- Evaluates section organization
- Provides format recommendations
- Suggests improvements for ATS readability

### CLI Command
```bash
npm run dev -- enhance ats <job-id>
```

### Scoring Breakdown
- **Keyword Match**: How well resume matches job keywords
- **Skill Match**: Technical and soft skills alignment
- **Experience Relevance**: How relevant past experience is
- **Format Score**: ATS-friendly formatting

### Database Storage
- Table: `ATSAnalysis`
- Fields: overallScore, atsMatchScore, summaryScore, experienceScore, skillsScore, keywordAnalysis, recommendations

---

## Integration with Resume Tailor

When running `tailor <job-id> --enhanced`:

1. **First Run**: All 3 agents run and save to database
2. **Subsequent Runs**: Resume Tailor retrieves from database instead of regenerating

This creates a "virtuous cycle" where your master resume data improves over time.
