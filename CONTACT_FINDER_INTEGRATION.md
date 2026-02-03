# Contact Finder API Integration ✅

## What We Just Built

I've integrated all three contact finding APIs into your Resume Agent with a smart waterfall strategy!

## 🎯 Your API Credits

Based on your `.env`:

- **Hunter.io**: 50 credits/month (email finding)
- **Apollo.io**: 100 credits/month (email + enrichment)
- **RocketReach**: 5 credits/month (premium, most accurate) ⭐

## 📁 New Files Created

### 1. API Service Classes

- `src/services/hunter.service.ts` - Hunter.io integration
- `src/services/apollo.service.ts` - Apollo.io integration
- `src/services/rocketreach.service.ts` - RocketReach integration
- `src/services/contact-finder.service.ts` - Smart orchestrator

### 2. CLI Command

- `src/cli/commands/credits.ts` - View API usage

### 3. Updated Files

- `src/config/index.ts` - Added API configurations
- `src/types/index.ts` - Added contact finder types
- `src/cli/index.ts` - Registered credits command

## 🚀 How It Works

### Waterfall Strategy (Smart Usage)

When finding a hiring manager, the system uses this strategy:

#### For Low/Medium Priority Jobs:

```
1. Try Apollo.io (100 credits/month)
   ↓ If not found
2. Try Hunter.io (50 credits/month)
   ↓ If not found
3. Return null (no RocketReach for low priority)
```

#### For High Priority Jobs:

```
1. Try Apollo.io (100 credits/month)
   ↓ If not found
2. Try Hunter.io (50 credits/month)
   ↓ If not found
3. Try RocketReach ⭐ (5 credits/month - PREMIUM!)
   ↓ If not found
4. Return null
```

### Priority Levels

- **Low**: Regular job applications
- **Medium**: Jobs you really want (default)
- **High**: Dream jobs, senior roles, C-level contacts

## 📊 Usage Example

```typescript
import { getContactFinderService } from "@/services/contact-finder.service";

const finder = getContactFinderService();

// Find hiring manager (medium priority)
const contact = await finder.findContact(
  {
    firstName: "John",
    lastName: "Doe",
    company: "Google",
    companyDomain: "google.com",
    title: "Engineering Manager",
  },
  "medium", // priority: 'low' | 'medium' | 'high'
);

if (contact) {
  console.log("Found:", contact.email, contact.phone);
  console.log("Source:", contact.source); // 'apollo', 'hunter', or 'rocketreach'
  console.log("Confidence:", contact.confidence); // 0-100
}
```

## 🎨 CLI Command

### View Your Credits

```bash
npm run dev credits
```

This shows:

- Used credits for each service
- Remaining credits
- Percentage used
- Status (Good / Low / Exhausted)
- Recommendations

### Example Output:

```
Contact Finder API Credits
──────────────────────────

┌────────────────────┬────────┬────────────┬────────┬────────────┬───────────────┐
│ Service            │ Used   │ Remaining  │ Limit  │ % Used     │ Status        │
├────────────────────┼────────┼────────────┼────────┼────────────┼───────────────┤
│ Hunter.io          │ 15     │ 35         │ 50     │ 30.0%      │ ✓ Good        │
├────────────────────┼────────┼────────────┼────────┼────────────┼───────────────┤
│ Apollo.io          │ 25     │ 75         │ 100    │ 25.0%      │ ✓ Good        │
├────────────────────┼────────┼────────────┼────────┼────────────┼───────────────┤
│ RocketReach ⭐     │ 1      │ 4          │ 5      │ 20.0%      │ ✓ Available   │
└────────────────────┴────────┴────────────┴────────┴────────────┴───────────────┘

Recommendations:
✓ You have RocketReach credits! Use them for high-priority jobs only.

Usage Strategy:
  1. Apollo.io - First choice (100 credits/month)
  2. Hunter.io - Email backup (50 credits/month)
  3. RocketReach - High priority only! (5 credits/month) ⭐
```

## 🔑 API Features

### Hunter.io

- Find email by name + domain
- Domain search (all emails at company)
- Email verification
- Confidence scoring

### Apollo.io

- Person enrichment (email + phone)
- LinkedIn profile data
- Employment history
- Organization search

### RocketReach (Premium)

- Most accurate contact data
- Verified emails and phones
- Social profiles
- Direct phone numbers

## 💡 Smart Features

### Credit Management

Each service tracks its own usage:

```typescript
hunter.getRemainingCredits(); // 35
apollo.getRemainingCredits(); // 75
rocketReach.getRemainingCredits(); // 4
```

### Automatic Fallback

If one service is exhausted, automatically tries the next:

- Apollo exhausted? → Falls back to Hunter
- Hunter exhausted? → Falls back to RocketReach (high priority only)

### Monthly Reset

Credits reset on the 1st of each month (you'll need to manually call):

```typescript
hunter.resetMonthlyCount();
apollo.resetMonthlyCount();
rocketReach.resetMonthlyCount();
```

## 🎯 When to Use High Priority

Use `priority: 'high'` for:

- ✅ Director+ or C-level contacts
- ✅ Dream companies (FAANG, unicorns)
- ✅ Roles you're perfectly qualified for
- ✅ Companies you have referrals at
- ✅ Senior positions ($150k+)

Don't use for:

- ❌ Recruiter spam
- ❌ Jobs you're barely qualified for
- ❌ Companies you're not excited about
- ❌ Junior positions

## 📦 Integration with Hiring Manager Finder

This will be used in Week 6 when we build the Hiring Manager Finder agent:

```typescript
// Week 6 - Hiring Manager Finder Agent
class HiringManagerFinderAgent {
  async findManager(job: Job, priority: JobPriority) {
    // 1. Try LinkedIn search (free)
    let contact = await this.searchLinkedIn(job);

    // 2. Try company website (free)
    if (!contact) {
      contact = await this.scrapeCompanyWebsite(job);
    }

    // 3. Use contact finder APIs (paid)
    if (!contact) {
      contact = await contactFinder.findContact(
        {
          firstName: extractedFirstName,
          lastName: extractedLastName,
          company: job.company,
          companyDomain: job.companyDomain,
        },
        priority,
      );
    }

    return contact;
  }
}
```

## 🔒 Security Note

Your API keys are now in `.env`:

```env
HUNTER_API_KEY="b365629664ae269c2bbee58abadf7569be477665"
APOLLO_API_KEY="hs9k_Tokyi4OZKAJf_Lv8g"
ROCKETREACH_API_KEY="1d29ea6kd7247d7e1c1182fe64f5779df542a607"
```

⚠️ **Never commit `.env` to Git!** (already in `.gitignore`)

## ✅ To Copy to Your Project

Copy these new files:

```bash
# API Services
cp /home/claude/src/services/hunter.service.ts ./src/services/
cp /home/claude/src/services/apollo.service.ts ./src/services/
cp /home/claude/src/services/rocketreach.service.ts ./src/services/
cp /home/claude/src/services/contact-finder.service.ts ./src/services/

# CLI Command
cp /home/claude/src/cli/commands/credits.ts ./src/cli/commands/

# Updated files
cp /home/claude/src/config/index.ts ./src/config/
cp /home/claude/src/types/index.ts ./src/types/
cp /home/claude/src/cli/index.ts ./src/cli/
```

Then rebuild:

```bash
npm install  # Install axios if not already there
npm run dev credits  # Test the credits command!
```

## 🎉 What's Next?

Now you have:

- ✅ All 3 contact finder APIs integrated
- ✅ Smart waterfall strategy
- ✅ Credit tracking
- ✅ CLI command to view usage

**Ready to continue with Week 2 implementation?** (Master Resume Management)

Or should we build the Hiring Manager Finder agent now since the APIs are ready?

Let me know!
