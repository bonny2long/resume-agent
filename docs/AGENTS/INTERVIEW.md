# Interview Preparation Agents

Agents focused on helping you ace the interview.

## Behavioral Interview Coach (Meta/FAANG)

**File**: `src/agents/interview/behavioral-coach.agent.ts`

**Inspiration**: Meta and other FAANG companies are known for rigorous behavioral interviews using the STAR method.

### What It Does

Generates a comprehensive interview preparation kit:

1. **STAR Story Bank**: 8-10 detailed stories covering common categories:
   - Leadership
   - Conflict Resolution
   - Failure & Recovery
   - Innovation
   - Collaboration
   - Handling Pressure
   - Customer Success
   - Personal Growth

2. **Question Mapping**: Maps common interview questions to relevant stories

3. **Delivery Tips**: Guidance on:
   - Pacing your responses
   - Detail level (not too short, not too long)
   - What interviewers listen for

### CLI Command

```bash
# Generate stories for a role
npm run dev -- enhance interview "Software Engineer"

# Export to DOCX for interview practice
npm run dev -- enhance interview "Software Engineer" --export
```

### Database Storage

- Table: `STARStory`
- Fields: title, category, situation, task, action, result, metrics, lessons

---

## How to Use STAR Stories

### Structure Each Response

```
S - Situation: Set the scene
T - Task: Explain your responsibility
A - Action: Describe what YOU did specifically
R - Result: Share the outcome (quantify if possible)
```

### Example Categories

| Category | Example Questions |
|----------|-------------------|
| Leadership | "Tell me about a time you led a team" |
| Conflict | "Describe a disagreement with a coworker" |
| Failure | "Tell me about a mistake you made" |
| Innovation | "Share an idea you implemented" |
| Collaboration | "Work with someone difficult?" |
| Pressure | "Handle a tight deadline?" |
| Customer | "Dealt with an unhappy customer?" |
| Growth | "Skill you improved recently?" |

---

## Integration with Enhanced Pipeline

When running `tailor <job-id> --enhanced` or `apply <job-url> --enhanced`:

- Step 5 generates STAR stories
- Stories are saved to database
- Can be exported to DOCX for offline practice
