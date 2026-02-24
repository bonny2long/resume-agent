# Career Development Agents

Long-term career planning and strategy agents.

## Salary Negotiator (Robert Half)

**File**: `src/agents/career/salary-negotiator.agent.ts`

**Inspiration**: Robert Half is the leading global staffing and recruiting firm, known for salary expertise.

### What It Does

Creates a comprehensive salary negotiation strategy:

1. **Market Analysis**: Compares your background to market data
2. **Target Range**: Calculates appropriate salary range
3. **Talking Points**: Key arguments for negotiation
4. **Objection Handling**: Responses to common pushback
5. **Email Templates**: Draft emails for negotiation

### CLI Command

```bash
# Generate strategy for a job
npm run dev -- enhance salary <job-id>

# Export negotiation playbook to DOCX
npm run dev -- enhance salary --export
```

---

## Personal Brand Strategist (Heidrick & Struggles)

**File**: `src/agents/career/personal-brand.agent.ts`

**Inspiration**: Heidrick & Struggles is a premier executive search firm specializing in leadership.

### What It Does

Builds your personal brand strategy:

1. **Positioning Statement**: How you want to be perceived
2. **Thought Leadership Topics**: Areas to establish expertise
3. **Content Strategy**: What to share and how often
4. **Network Building**: Key connections to make
5. **90-Day Action Plan**: Immediate steps to take

### CLI Command

```bash
# Generate brand strategy for a target role
npm run dev -- enhance brand "Tech Lead"
npm run dev -- enhance brand "Engineering Manager"
```

---

## Career Pivot Strategist (Korn Ferry)

**File**: `src/agents/career/career-pivot.agent.ts`

**Inspiration**: Korn Ferry is a global organizational consulting firm specializing in talent management.

### What It Does

Plans your career transition:

1. **Pivot Narrative**: How to tell your career story
2. **Transferable Skills**: Skills that translate to new field
3. **Gap Analysis**: What you need to learn
4. **Network Strategy**: How to break into new field
5. **Timeline**: Realistic transition timeline

### CLI Command

```bash
# Generate pivot plan
npm run dev -- enhance pivot

# Export to DOCX
npm run dev -- enhance pivot --export
```

---

## LinkedIn Optimizer (Spencer Stuart)

**File**: `src/agents/linkedin/linkedin-optimizer.agent.ts`

**Inspiration**: Spencer Stuart is a leading executive search and leadership consulting firm.

### What It Does

Optimizes your LinkedIn profile:

1. **Headline**: Compelling professional headline
2. **About Section**: Impactful summary
3. **Experience Section**: How to describe your background
4. **Skills Ranking**: Which skills to highlight
5. **Content Strategy**: What to post about

### CLI Command

```bash
# Generate optimization for a target role
npm run dev -- enhance linkedin "Full Stack Engineer"
```

---

## Summary Table

| Agent | Firm Inspiration | CLI Command |
|-------|-----------------|-------------|
| Salary Negotiator | Robert Half | `enhance salary <job-id>` |
| Personal Brand | Heidrick & Struggles | `enhance brand <role>` |
| Career Pivot | Korn Ferry | `enhance pivot` |
| LinkedIn Optimizer | Spencer Stuart | `enhance linkedin <role>` |
