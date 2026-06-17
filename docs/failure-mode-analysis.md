# Failure Mode Analysis — PRD Engineering Gap Analyzer

This document identifies all known failure modes in the system, their impact, how they are detected, and how they are mitigated.

---

## 1. Over-Flagging

**Description**  
The system flags too many gaps, overwhelming the user with noise. A PRD that genuinely has 3 real issues receives 20 flagged gaps, making the output feel untrustworthy.

**Impact**  
Users dismiss all findings ("the tool cried wolf") and stop trusting the high-confidence critical gaps that actually matter. Feedback thumbs-down rate rises. Tool adoption drops.

**Detection**  
- Feedback data: thumbs-down rate > 20% on any gap category
- Admin dashboard: avg gaps per PRD consistently above 12
- Manual review: running test PRDs and checking if obvious non-issues are flagged

**Mitigation**  
- Hard cap: `MAX_TOTAL_GAPS = 15` enforced in gap merger regardless of how many are detected
- AI confidence filter: `MIN_CONFIDENCE = 0.65` — GPT-4o gaps below this threshold are discarded
- AI gap cap: `MAX_AI_GAPS = 10` — GPT-4o cannot contribute more than 10 gaps even if it returns more
- Deduplication: gap merger drops AI findings with >50% word overlap with logic engine findings
- Severity sorting: if cap is hit, lower severity gaps are dropped first — only the most important gaps survive
- System prompt instructs GPT-4o explicitly not to repeat logic engine findings

---

## 2. Under-Flagging

**Description**  
The system misses real gaps. A PRD with a critical missing security requirement scores a B grade and the security gap is not in the output.

**Impact**  
The PM ships a flawed PRD with false confidence, leading to exactly the engineering rework the tool was meant to prevent.

**Detection**  
- Test case TC-28 (perfect PRD) and TC-29 (weak PRD) used as regression benchmarks
- Manual evaluation: running known-bad PRDs and checking that all expected gaps appear
- Feedback data: thumbs-up rate on gaps that appear vs absence of expected gaps

**Mitigation**  
- Two-layer architecture: logic engine catches structural gaps deterministically (cannot be missed if pattern is in the text), GPT-4o catches semantic gaps the rules miss
- The system prompt explicitly lists gap categories GPT-4o should look for (security, compliance, business logic, data privacy)
- Section detector checks 8 sections — any missing section is guaranteed to be flagged
- Ambiguity detector covers 12 rule categories with multiple keyword variants per rule
- Missing logic detector covers 7 independent checks, each running separately

---

## 3. Hallucinated Issues (AI Only)

**Description**  
GPT-4o invents a gap that does not exist in the PRD. For example, it flags "missing rate limiting" when the PRD explicitly defines rate limiting at 100 requests/minute.

**Impact**  
User sees a "critical" finding that is factually wrong. Trust in the AI layer collapses. Thumbs-down rate spikes for AI-sourced gaps.

**Detection**  
- Source badges on every gap: "AI Detected" vs "Logic Engine" — users can visually identify which gaps to scrutinise
- Feedback data: thumbs-down rate specifically on `source: 'ai'` gaps
- Temperature setting: `temperature: 0.2` in the OpenAI call reduces creative/hallucinated output

**Mitigation**  
- Low temperature (0.2): forces GPT-4o toward conservative, grounded responses
- System prompt instructs: "Only flag gaps you can directly infer from the text or its absence"
- User prompt includes the full PRD text: GPT-4o is grounded in the actual document
- Confidence filter (0.65 minimum): low-confidence hallucinations are filtered before reaching the user
- Source badge transparency: every AI gap is labelled — users know to apply more scrutiny
- Feedback loop: thumbs-down data can be used to identify hallucination patterns over time

---

## 4. Duplicate Findings

**Description**  
The same gap appears twice — once from the logic engine and once from GPT-4o. For example, "Missing Error Handling" appears as both a logic engine finding and an AI finding.

**Impact**  
Output looks redundant and amateurish. Users lose confidence in the deduplication logic.

**Detection**  
- Visual inspection: scanning gap list for near-identical descriptions
- Unit test TC-35: verify duplicate AI gaps are dropped

**Mitigation**  
- Gap merger deduplication: for each AI gap, word overlap is calculated against all logic engine gaps. If overlap ratio > 50% on words longer than 4 characters, the AI gap is dropped
- System prompt: explicitly instructs GPT-4o "DO NOT repeat findings already identified in the logic engine report" and lists all logic engine findings in the user prompt
- Logic engine findings are shown to GPT-4o before it analyses — it knows what has already been caught

---

## 5. Invalid JSON from GPT-4o

**Description**  
GPT-4o returns a response that is not valid JSON — it includes markdown fences, explanation text, or a malformed structure.

**Impact**  
The JSON.parse() call throws an error. Without a fallback, the entire analysis request fails with HTTP 500.

**Detection**  
- Try/catch around JSON.parse in `prdAnalyzer.ts`
- Error logged with first 200 characters of raw GPT-4o response for debugging

**Mitigation**  
- Pre-parse cleaning: `rawContent.replace(/```json|```/g, '').trim()` strips markdown fences before parsing
- System prompt uses "Return ONLY valid JSON, no markdown, no explanation text outside JSON" with explicit instruction repeated twice
- Graceful fallback: the try/catch in `analyzeWithAI` is wrapped in the route handler's own try/catch. If OpenAI fails for any reason, `aiResult = { gaps: [], aiSummary: '' }` is used and the logic engine results are returned successfully (HTTP 201, not 500)
- Zod validation on the parsed gap array: each gap is validated for required fields before being accepted

---

## 6. API Failure (OpenAI Unavailable)

**Description**  
The OpenAI API returns a network error, timeout, rate limit (HTTP 429), or server error (HTTP 500/503).

**Impact**  
Without a fallback, the entire analysis fails even though the logic engine already ran successfully in ~11ms.

**Detection**  
- OpenAI SDK throws an error that propagates to the route handler
- Error is logged with `logger.warn({ err }, "OpenAI analysis failed — using logic engine results only")`

**Mitigation**  
- Graceful degradation: the OpenAI call is wrapped in its own try/catch inside the route handler. If it fails, `aiResult = { gaps: [], aiSummary: '' }` and the pipeline continues with logic engine results only
- The response still returns HTTP 201 with all logic engine gaps, `aiGapCount: 0`, `aiSummary: ""`
- User experience: the analysis detail page renders normally with logic engine gaps — the AI Summary card simply does not appear (conditionally rendered on `aiSummary` being non-empty)
- Future improvement: queue failed AI analyses for retry, notify user when AI results are ready

---

## 7. Database Failure

**Description**  
The PostgreSQL database is unavailable, the connection pool is exhausted, or a query fails.

**Impact**  
POST /api/analyses fails after the logic engine and GPT-4o have already run successfully — results are computed but cannot be stored.

**Detection**  
- Drizzle ORM throws an error that propagates to the route handler try/catch
- HTTP 500 returned to frontend with "Analysis failed. Please try again."
- Server logs capture the full database error with stack trace

**Mitigation**  
- Replit managed PostgreSQL: connection management, failover, and backups handled by the platform
- Connection pooling via `pg.Pool` in `lib/db/src/index.ts` — prevents connection exhaustion under load
- Route-level try/catch: all database errors are caught and returned as structured HTTP 500 responses, not unhandled crashes
- Future improvement: return computed results to the user even if storage fails (cache in memory, retry storage asynchronously)

---

## 8. Confidence Miscalculation

**Description**  
The confidence score is mathematically wrong — a PRD with all 8 sections and no issues scores 45/100 instead of 100/100, or vice versa.

**Impact**  
The readiness score is the primary output users act on. A wrong score undermines every decision made based on it.

**Detection**  
- Test cases TC-28 to TC-32 are deterministic regression tests for the confidence calculator
- TC-28: perfect PRD must score exactly 100
- TC-29: weak test PRD must score exactly 15
- TC-30: 4-of-8 sections PRD must score 80 (structureScore 20 + clarityScore 30 + completenessScore 30)
- These tests can be run against `/api/engine-test` at any time

**Mitigation**  
- Deterministic formula: no randomness, no AI involvement in scoring. Same input always produces same output
- Math.max(0, ...) used at each score component: scores cannot go negative regardless of how many issues are found
- Math.round() used on all computed values: no floating point leakage to the UI
- Score components are independent: a bug in clarityScore calculation cannot affect structureScore
- All three components are returned in the API response so each can be inspected individually
