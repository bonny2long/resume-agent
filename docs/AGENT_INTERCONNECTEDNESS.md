# Agent Interconnectedness Architecture & Integration Guide

## Overview

This document explains the design principles for creating interconnected, collaborative agents that share context and work together seamlessly in the resume application ecosystem.

## Current State Analysis

### ✅ **Working Well:**
- **Resume Tailor Agent**: Successfully generating company-specific, highly tailored summaries
- **Gemini Embeddings**: Working with fallback to avoid rate limits
- **Document Generation**: Full 3-paragraph summaries in DOCX files
- **Database Integration**: Proper data loading and storage

### ⚠️ **Siloed Components:**
- Each agent operates independently
- Duplicate data fetching (job + resume in multiple agents)
- No shared context between agents
- Lost insights between generation stages
- No workflow orchestration

## Target Architecture: Shared Context Ecosystem

### 🎯 **Core Design Principles**

#### 1. **Single Source of Truth**
```typescript
interface JobContext {
  id: string;
  url?: string;
  jobAnalysis: JobAnalysis;           // From Job Analyzer
  companyResearch: CompanyResearch;     // From Company Researcher
  masterResume: MasterResume;           // User's master data
  tailoredResume?: TailoredResume;       // Generated insights
  coverLetter?: CoverLetter;            // Generated letter
  generatedDocuments: DocumentPaths;       // Output files
  metadata: {
    createdAt: Date;
    lastUpdated: Date;
    stage: 'analyzed' | 'researched' | 'tailored' | 'generated' | 'ready';
  };
}
```

#### 2. **Context Propagation Flow**
```
Job URL → Job Analyzer → JobContextService
Company Name → Company Researcher → JobContextService  
Master Resume → Direct to All Agents
JobContext → Resume Tailor → JobContextService (updates)
JobContext → Cover Letter → JobContextService (reads from context)
All Results → Document Generator → JobContextService (updates)
```

#### 3. **Agent Communication Pattern**
```typescript
export abstract class BaseAgent<TInput, TOutput> {
  abstract execute(input: TInput, context?: JobContext): Promise<AgentResponse<TOutput>>;
  constructor(protected contextService: JobContextService) {}
}

export class ResumeTailorAgent extends BaseAgent<TailorInput, TailorOutput> {
  async tailorResume(jobId: string, context?: JobContext) {
    // Use existing context or create new
    const jobContext = context || await this.contextService.getOrCreateContext(jobId);
    
    // Execute with shared context
    const result = await this.generateTailored(jobContext.jobAnalysis, jobContext.masterResume, jobContext.companyResearch);
    
    // Update shared context for next agents
    await this.contextService.updateContext(jobId, { ...jobContext, tailoredResume: result.data });
    
    return { success: true, data: { ...result.data, context: jobContext } };
  }
}
```

## Implementation Strategy

### **Phase 1: Foundation Services**
1. **JobContextService**: Central state management
   - Creates, updates, retrieves job contexts
   - Manages workflow stage transitions
   - Provides caching for performance
   - Enables partial workflow execution

2. **Shared Models**: TypeScript interfaces for data consistency
   - `JobAnalysis`, `CompanyResearch`, `TailoredResume`
   - Standardized response types
   - Validation schemas

### **Phase 2: Agent Enhancement**
1. **Update existing agents** to accept optional `context` parameter
2. **Add context injection** to each agent's `execute()` method
3. **Update return types** to include generated context
4. **Remove duplicate data fetching** - use context service instead

### **Phase 3: Workflow Orchestration**
1. **ApplicationWorkflow**: Main orchestrator class
2. **Stage-based execution**: Sequential agent coordination
3. **Error handling**: Graceful failure and recovery
4. **Progress tracking**: Real-time workflow status

### **Phase 4: Integration Testing**
1. **Unit tests**: Individual agent testing with mock contexts
2. **Integration tests**: Full workflow simulation
3. **E2E tests**: End-to-end user scenarios
4. **Performance tests**: Context service load testing

## Current Agent Capabilities

### ✅ **Resume Tailor Agent**
```typescript
// Current Implementation
- Loads job details with company information
- Extracts company tech stack, values, responsibilities
- Uses AI to generate highly tailored, company-specific summaries
- Example IBM summary: "deep admiration for IBM's legacy of technological innovation..."
- Updates JobContextService with generated insights
```

### ✅ **Cover Letter Agent**
```typescript
// Current State
- Generates cover letters based on job and resume
- Has access to JobContextService for shared data
- Can read from tailored resume context
- Generates personalized content with company references
```

### ✅ **Document Generator Service**
```typescript
// Current State
- Multiple template support (modern, traditional, minimal)
- DOCX and PDF generation
- Works with structured resume data
- Full 3-paragraph summary support
```

### ⚠️ **Apply Command**
```typescript
// Current State - Needs Enhancement
- Placeholder implementation only
- Should orchestrate full workflow:
  1. Job Analysis → 2. Company Research → 3. Resume Tailoring → 4. Cover Letter → 5. Document Generation → 6. Application Record
- Should handle errors and retry logic
- Should provide progress tracking
```

## Data Flow Diagram

```
┌─────────────────┐
│   Job URL      │
└─────┬─────────┘
        │
        ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Job Analyzer   │   │ Company        │   │ Resume Tailor  │   │ Cover Letter    │   │ Document        │
│                │   │ Researcher      │   │                │   │                │   │ Generator       │
└─────┬─────────┘   └─────┬─────────┘   └─────┬─────────┘   └─────┬─────────┘   └─────┬─────────┘
        │                        │                │                   │                │
        ▼                        ▼                ▼                   ▼                ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ JobContextService│──▶│   Resume Tailor  │──▶│ Cover Letter    │──▶│ Document        │──▶│ Application     │
│                │   │                │   │                │   │                │   │                │
└─────┬─────────┘   └─────┬─────────┘   └─────┬─────────┘   └─────┬─────────┘   └─────┬─────────┘
        │                        │                │                   │                │
        ▼                        ▼                ▼                   ▼                ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                     Database (PostgreSQL + pgvector)                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Testing Scenarios

### **Scenario 1: New Job Application**
```bash
# User runs complete workflow
npm run dev apply https://careers.microsoft.com/job

# Expected Flow:
1. Job Analyzer extracts job details
2. Company Researcher gathers company info
3. Resume Tailor generates tailored resume
4. Cover Letter Agent creates personalized letter
5. Document Generator creates files
6. Application Record created with all file paths
```

### **Scenario 2: Resume Only Generation**
```bash
# User wants just tailored resume
npm run dev tailor 4afe5745-bd3f-4e5a-afa7-4e300e320129

# Expected Flow:
1. Check existing JobContext
2. Generate new tailored resume using existing context
3. Update context with new tailored resume
4. Generate documents
```

### **Scenario 3: Context Reuse**
```bash
# User applies to another role at same company
npm run dev tailor new-job-id

# Expected Flow:
1. Reuse existing company research from JobContextService
2. Generate new tailored resume with existing company context
3. Reuse and adapt existing career transition story
```

## Benefits of Interconnected Architecture

### 🎯 **For End Users:**
1. **Consistent Experience**: All agents share the same job data and context
2. **Faster Processing**: No duplicate data fetching or calculations
3. **Better Quality**: Insights flow between agents (company research → resume → cover letter)
4. **Partial Workflows**: Generate just cover letter or just resume
5. **Recovery**: Can resume interrupted workflows from any stage

### 🔧 **For Development:**
1. **Easier Testing**: Mock contexts for unit tests
2. **Better Debugging**: Clear data flow and state management
3. **Scalability**: Easy to add new agents or modify workflows
4. **Performance**: Caching and context reuse reduce API calls
5. **Maintainability**: Separation of concerns with shared services

## Migration Strategy

### **Step 1: JobContextService**
```typescript
// src/services/job-context.service.ts
export class JobContextService {
  private contexts = new Map<string, JobContext>();
  
  async getOrCreateContext(jobId: string): Promise<JobContext> {
    // Check if context exists
    let context = this.contexts.get(jobId);
    
    if (!context) {
      // Create new context with initial job analysis
      context = await this.createInitialContext(jobId);
      this.contexts.set(jobId, context);
    }
    
    return context;
  }
  
  async updateContext(jobId: string, updates: Partial<JobContext>): Promise<void> {
    const context = this.contexts.get(jobId);
    if (context) {
      // Merge updates with existing context
      const updatedContext = { ...context, ...updates };
      this.contexts.set(jobId, updatedContext);
    }
  }
}
```

### **Step 2: Agent Base Class**
```typescript
// src/agents/base.agent.ts
export abstract class BaseAgent<TInput, TOutput> {
  constructor(protected contextService: JobContextService) {}
  
  protected async getJobContext(jobId: string): Promise<JobContext> {
    return await this.contextService.getOrCreateContext(jobId);
  }
  
  protected async updateJobContext(jobId: string, updates: Partial<JobContext>): Promise<void> {
    await this.contextService.updateContext(jobId, updates);
  }
}
```

## Performance Considerations

### **Context Caching Strategy**
```typescript
// Context cached in memory + persisted in database
interface CachedContext {
  data: JobContext;
  createdAt: Date;
  expiresAt: Date; // 24 hours
}

export class ContextManager {
  private cache = new Map<string, CachedContext>();
  
  async getContext(jobId: string): Promise<JobContext | null> {
    // Check memory cache first
    const cached = this.cache.get(jobId);
    if (cached && cached.expiresAt > new Date()) {
      return cached.data;
    }
    
    // Check database
    const persisted = await this.loadFromDatabase(jobId);
    if (persisted && !this.isStale(persisted)) {
      this.cache.set(jobId, {
        data: persisted,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      return persisted;
    }
    
    return null;
  }
}
```

### **API Rate Limit Handling**
```typescript
// Smart retry with exponential backoff
export class RateLimitedAgent {
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        if (error.status === 429 && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    
    throw new Error(`Operation failed after ${maxRetries} attempts`);
  }
}
```

## Testing Checklist

### **Unit Tests**
- [ ] Context service creates and retrieves contexts correctly
- [ ] Agents use existing context when provided
- [ ] Agents update context after successful operations
- [ ] Error handling preserves existing context

### **Integration Tests**
- [ ] Full workflow executes end-to-end
- [ ] Context properly flows between agents
- [ ] Database transactions handle concurrent access
- [ ] File generation uses latest context

### **E2E Tests**
- [ ] User can apply to job from URL to generated documents
- [ ] Workflow handles partial failures gracefully
- [ ] Context persistence survives application restart
- [ ] Performance under load (multiple concurrent jobs)

## Security Considerations

### **Data Validation**
```typescript
// Validate context before using
export const validateJobContext = (context: JobContext): boolean => {
  if (!context.id || !context.jobAnalysis) return false;
  if (!context.metadata?.createdAt) return false;
  if (new Date() - context.metadata.createdAt > 7 * 24 * 60 * 60 * 1000) return false; // 7 days old
  return true;
};
```

### **Isolation**
```typescript
// Each agent gets isolated job context copy
export const createAgentContext = (sharedContext: JobContext): JobContext => {
  return JSON.parse(JSON.stringify(sharedContext)) as JobContext;
};
```

## Next Steps

### **Immediate Priorities**
1. ✅ **JobContextService**: Implement central state management
2. ✅ **Agent Updates**: Add context parameter to all agents
3. ✅ **BaseAgent Class**: Create shared agent interface
4. ✅ **Workflow Orchestrator**: Implement full application workflow

### **Future Enhancements**
1. 🔄 **Real-time Updates**: WebSocket-based context synchronization
2. 📊 **Analytics Dashboard**: Track agent performance and success rates
3. 🤖 **AI Agent Coordination**: Multiple specialized AI agents working together
4. 📱 **Mobile Support**: Application tracking on mobile devices
5. 🔗 **Integration APIs**: External ATS and job board APIs

---

*This document will be updated as the interconnected agent architecture evolves.*