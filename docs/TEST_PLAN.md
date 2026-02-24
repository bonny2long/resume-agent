# Test Plan - Document Generator Fixes

## 🧪 Testing Instructions

### 1. Test Experience Deduplication
```bash
# Generate a resume and check the experience section
npm run dev generate <job-id> modern
```

**Expected Results:**
- ✅ No duplicate companies/positions
- ✅ Most recent experience appears first
- ✅ If you had "Software Engineer at CompanyX" in multiple master resumes, only the most relevant version should appear

### 2. Test URL Validation
Check the contact section of generated resume:
- ✅ LinkedIn URL should be valid (contain "linkedin.com") or absent
- ✅ GitHub URL should be valid (contain "github.com") or absent  
- ✅ Portfolio URL should be valid (contain "http") or absent
- ❌ Should NOT see "Bonny" as LinkedIn URL

### 3. Test All Three Templates

#### Modern Template
```bash
npm run dev generate <job-id> modern
```
**Expected:**
- ✅ Blue color accents on section headers (#2C5F8D)
- ✅ Skills grouped by category (Languages, Frameworks, etc.)
- ✅ Summary ~42 words, complete sentences
- ✅ Accent line under name

#### Traditional Template
```bash
npm run dev generate <job-id> traditional
```
**Expected:**
- ✅ Name in ALL CAPS
- ✅ Times New Roman font
- ✅ Summary ~65 words, complete sentences
- ✅ No empty "| Dec 2016" locations

#### Minimal Template
```bash
npm run dev generate <job-id> minimal
```
**Expected:**
- ✅ Email only in contact (no phone)
- ✅ Name size 44pt (larger)
- ✅ Maximum 10 skills
- ✅ Summary ~28 words

### 4. Verify Summary Lengths
Check each template's summary:
- **Minimal**: 25-30 words
- **Modern**: 40-45 words  
- **Traditional**: 55-65 words

All should end at complete sentences, not cut off mid-sentence.

### 5. Check Experience Order
Experiences should be in chronological order:
1. Most recent job first
2. Next most recent
3. And so on...

## 🐛 Troubleshooting

### If you still see duplicates:
1. Check if company names or titles have slight differences
2. Run with verbose logging to see deduplication messages

### If URLs are still wrong:
1. Check your master resume data in the database
2. Update LinkedIn URL from "Bonny" to actual profile URL

### If templates look wrong:
1. Ensure you replaced the entire `document-generator.service.ts` file
2. Check that all imports are intact

## ✅ Success Criteria

- [ ] No duplicate experiences
- [ ] Proper chronological order
- [ ] Valid URLs (or absent if invalid)
- [ ] Correct summary lengths for each template
- [ ] Template-specific formatting working
- [ ] No cutoff sentences or empty locations

If all of these pass, your document generator is fully fixed! 🎉