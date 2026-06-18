# Failure Mode Analysis — PRD Engineering Gap Analyzer

This document identifies all known failure modes in the system, their likelihood, impact severity, detection mechanism, and mitigation strategy. It is intended as both a design record and a testing reference — each failure mode maps to one or more test cases that can be run to verify the mitigation is working.

---

## Failure Mode Index

| # | Failure Mode | Likelihood | Impact | Mitigated? |
|---|---|---|---|---|
| 1 | Over-Flagging | Medium | High | Yes — hard caps + confidence filter |
| 2 | Under-Flagging | Low | Critical | Yes — two-layer architecture |
| 3 | Hallucinated Issues (AI) | Medium | High | Yes — temperature + source badges + confidence filter |
| 4 | Duplicate Findings | Low | Medium | Yes — gap merger deduplication |
| 5 | Invalid JSON from GPT-4o | Low | Medium | Yes — pre-clean + graceful fallback |
| 6 | OpenAI API Failure | Medium | Medium | Yes — graceful degradation |
| 7 | Database Failure | Low | High | Yes — Replit managed DB + try/catch |
| 8 | Confidence Miscalculation | Very Low | Critical | Yes — deterministic formula + Math.max floors |

---

## 1. Over-Flagging

### Description

The system flags too many gaps, overwhelming the user with noise. A PRD that genuinely has 3 real issues receives 12–20 flagged gaps, making the output feel untrustworthy. This typically happens when:
- The ambiguity detector fires on every occurrence of words like "should" or "some"
- GPT-4o finds speculative gaps at low confidence that are not filtered
- The logic engine's conditional checks fire correctly but stack with AI findings on the same topic
- A PRD uses technical language that triggers multiple overlapping rules

### Impact

Users dismiss all findings because the tool "cried wolf." Even genuinely critical gaps get ignored when buried in noise. The thumbs-down feedback rate rises across all categories. Long-term, users stop submitting PRDs to the tool entirely. The value proposition collapses.

### Detection

- Admin dashboard: avg gaps per PRD consistently above 12 (the expected range is 5–10)
- Feedback data: thumbs-down rate exceeding 20% on any gap category, particularly "Ambiguous Requirement"
- Manual spot-check: running a known good PRD (all 8 sections, no vague language, clear specs) and verifying gap count stays low
- Test endpoint: `GET /api/engine-test` on the sample PRD — if it returns more than 15 gaps, something in the pipeline is misconfigured

### Mitigation

**Hard cap:** `MAX_TOTAL_GAPS = 15` enforced in `gapMerger.ts` line 14. Regardless of how many issues are detected, only the top 15 by severity + confidence reach the user. Critical gaps are never cut; low-severity gaps are cut first.

**AI confidence filter:** `MIN_CONFIDENCE = 0.65` in `prdAnalyzer.ts`. GPT-4o gaps below this threshold are discarded after validation. Low-confidence speculative findings never reach the merger.

**AI gap cap:** `MAX_AI_GAPS = 10` in `prdAnalyzer.ts`. Even if GPT-4o returns 20 gaps all above 0.65 confidence, only the first 10 are accepted.

**Deduplication:** For each AI gap, word overlap is calculated against all logic engine gaps. If overlap ratio > 50% on words longer than 4 characters, the AI gap is dropped. This prevents "Missing Error Handling" appearing twice from two different sources.

**Ambiguity deduplication by suggestion:** Multiple occurrences of the same ambiguous word type (e.g. "fast" appearing 3 times in a PRD) are collapsed to a single gap because they share the same suggestion text.

**GPT-4o system prompt:** The prompt explicitly instructs GPT-4o not to repeat logic engine findings and shows it the full list of already-detected issues.

---

## 2. Under-Flagging

### Description

The system misses real gaps. A PRD with a critical missing security requirement scores a B grade and the security gap does not appear in the output. This typically happens when:
- A required section exists with a heading but has no actual content (section detector counts it as present)
- A critical gap uses language that doesn't match any of the logic engine's patterns
- GPT-4o is given a context that implies the gap is already handled (false positive in the EngineReport summary)
- The 15-gap cap causes a real gap to be cut when there are many higher-severity gaps

### Impact

The PM ships a flawed PRD with false confidence that the tool gave it a clean bill of health. Engineering begins development against an incomplete spec. The rework happens downstream — exactly the problem the tool was built to prevent. Trust in the tool collapses when this is discovered.

### Detection

- Regression testing: run known-bad PRDs (PRDs with intentionally planted gaps) and verify all planted gaps appear in the output
- Manual evaluation: compare the tool's output against an expert human review of the same PRD
- Feedback data: monitor for cases where thumbs-up rate is high but real-world rework still occurs

### Mitigation

**Two-layer architecture:** The logic engine catches all structural gaps deterministically — if the pattern is in the text, the gap is guaranteed to be detected. GPT-4o then independently reviews the PRD for semantic gaps the rules cannot find. Neither layer alone can be under-flagged without the other compensating.

**Section detector covers 8 sections:** Any missing section is guaranteed to be flagged with 0.99 confidence. The only edge case is a section heading with empty body — the detector sees the heading and counts it as present even if no content follows.

**Ambiguity detector covers 12 rule categories with 40+ trigger words:** Multiple synonyms per rule ensure that reworded versions of the same vague concept are still caught.

**7 independent conditional checks in missingLogicDetector:** Each check runs separately. A bug in one check does not prevent the others from firing.

**GPT-4o system prompt specificity:** The prompt explicitly lists gap categories GPT-4o should look for: security, compliance, business logic, data privacy, feasibility, integration risks, non-functional requirements. This reduces the chance of GPT-4o missing a whole category of gaps.

**Acceptance Criteria and Error Handling are hardcoded as critical:** These two sections are the most commonly missing and highest-impact. They are guaranteed to be flagged as `critical` severity even if GPT-4o fails entirely.

---

## 3. Hallucinated Issues (AI Only)

### Description

GPT-4o invents a gap that does not exist in the PRD. For example:
- Flags "missing rate limiting" when the PRD explicitly defines rate limiting at 100 req/min
- Flags "missing GDPR compliance" when the PRD states it is an internal tool with no user data
- Flags "missing authentication" when the PRD is for a public read-only dashboard with no login

This happens because GPT-4o is a probabilistic model that can infer patterns from training data rather than the specific document in front of it.

### Impact

A PM sees a "critical" finding that is factually wrong. They spend time investigating an issue that doesn't exist. Their trust in all AI-sourced findings collapses — including the real ones. The thumbs-down rate spikes specifically on `source: 'ai'` gaps.

### Detection

- Source badges: every gap card shows "Logic Engine" (blue) or "AI Detected" (purple) — users can see which findings to scrutinise more carefully
- Feedback data: track thumbs-down rate specifically on AI-sourced gaps vs logic-engine-sourced gaps
- Manual spot-check: submit a well-written PRD with explicit coverage of all common gap categories and verify no hallucinated gaps appear

### Mitigation

**Low temperature (0.2):** Forces GPT-4o toward conservative, grounded responses. Higher temperatures (0.7+) produce more creative but less reliable output.

**`response_format: { type: "json_object" }`:** Forces structured output, reducing the chance of mixed-format responses that include reasoning text that distorts the findings.

**User prompt includes the full PRD text:** GPT-4o is grounded in the actual document. It cannot hallucinate a gap that is explicitly disproved by the text it was given.

**Confidence filter (MIN_CONFIDENCE = 0.65):** Hallucinations tend to have lower confidence because GPT-4o is less certain about findings it invented. Filtering out low-confidence gaps removes many hallucinations before they reach the user.

**System prompt instruction:** "Only flag gaps you can directly infer from the text or its absence."

**Source badge transparency:** Every AI gap is visually labelled. Users know to apply more scrutiny to purple "AI Detected" badges than blue "Logic Engine" badges. This doesn't prevent hallucinations but it contains their damage.

**Feedback loop:** Thumbs-down data on AI gaps, aggregated in the admin dashboard, can identify hallucination patterns over time. If "Missing Rate Limiting" is consistently thumbed-down, the system prompt can be updated to be more specific.

---

## 4. Duplicate Findings

### Description

The same gap appears twice in the output — once from the logic engine and once from GPT-4o. Examples:
- "Missing Error Handling" (logic engine) + "The PRD does not define failure recovery procedures" (GPT-4o)
- "Missing Acceptance Criteria" (logic engine) + "No definition of done is provided" (GPT-4o)

Both describe the same gap in different words, but both pass through to the user.

### Impact

The output looks redundant and amateurish. Users lose confidence in the deduplication logic. The 15-gap cap may be reached with duplicate content, pushing real unique findings off the list.

### Detection

- Visual inspection: scanning the gap list for near-identical descriptions on the same topic
- Test: submit a PRD that is missing the Acceptance Criteria section — verify only one gap about Acceptance Criteria appears, regardless of GPT-4o's response

### Mitigation

**Word overlap deduplication in gapMerger.ts:**
```
For each AI gap:
  aiWords = set of words in description where length > 4
  For each logic engine gap:
    existingWords = words in description where length > 4
    overlap = intersection of aiWords and existingWords
    overlapRatio = overlap.size / min(aiWords.size, existingWords.size)
    if overlapRatio > 0.5 → DROP the AI gap
```

The 4-character minimum length filter excludes stopwords ("the", "is", "of", "for") so only meaningful content words count toward overlap.

**System prompt:** GPT-4o is explicitly told "DO NOT repeat findings already identified in the logic engine report" and is shown the full list of already-detected issues in the user prompt. This reduces the rate of near-duplicate AI findings at the source.

**Suggestion-based deduplication for ambiguity:** Multiple instances of the same ambiguous word type (e.g. "fast" appearing 4 times) are collapsed to a single gap by deduplicating on the suggestion text — same suggestion = same rule = one gap.

---

## 5. Invalid JSON from GPT-4o

### Description

GPT-4o returns a response that is not valid JSON. Common causes:
- Response includes markdown code fences (` ```json ... ``` `)
- Response includes explanation text before or after the JSON object
- Response is truncated because max_tokens was reached mid-output
- Response is a valid JSON array instead of a JSON object (structure mismatch)
- GPT-4o returns an error message instead of the requested format

### Impact

`JSON.parse()` throws a SyntaxError. Without handling, the entire analysis request fails with an unhandled exception and returns HTTP 500. The user sees a generic error and loses their analysis — even though the logic engine ran successfully in ~11ms.

### Detection

- The try/catch around JSON.parse in `prdAnalyzer.ts` catches this and throws a descriptive error: `"GPT-4o returned invalid JSON: <first 200 chars>"`
- This error propagates to the route handler's outer try/catch, which logs it as WARN and falls back gracefully

### Mitigation

**Pre-parse cleaning:**
```typescript
const clean = rawContent.replace(/```json|```/g, '').trim()
```
Strips markdown fences before parsing. Handles the most common format deviation.

**`response_format: { type: "json_object" }`:** This OpenAI parameter enforces that the response is valid JSON at the API level. It significantly reduces the rate of non-JSON responses.

**System prompt double-emphasis:** "Return ONLY valid JSON, no markdown, no explanation text outside JSON" — stated explicitly and reinforced by the provided schema structure.

**Graceful fallback at route level:** The entire `analyzeWithAI` call is wrapped in a try/catch in the route handler. If JSON parsing fails and `analyzeWithAI` throws, the route catches it, logs a warning, and continues with `aiResult = { gaps: [], aiSummary: "" }`. The analysis returns HTTP 201 with logic engine results — not HTTP 500.

**Gap array validation:** Even if JSON.parse succeeds, each gap object is validated field-by-field. A malformed gap (missing severity, non-numeric confidence) is filtered out rather than causing a runtime error downstream.

---

## 6. OpenAI API Failure

### Description

The OpenAI API is unavailable, slow, or returns an error. Common causes:
- Network connectivity issue between Replit and api.openai.com
- OpenAI service outage or degraded performance
- Rate limit exceeded (HTTP 429)
- Invalid or expired API key (HTTP 401)
- Request timeout (GPT-4o takes >30 seconds for a large PRD)
- Insufficient account credits

### Impact

Without a fallback, the entire `POST /api/analyses` request fails after the logic engine has already completed successfully. The user sees a 500 error. All logic engine work (~11ms, zero cost) is lost.

### Detection

- The OpenAI SDK throws an error object with a `status` code and `message`
- The route handler catches this in its try/catch and logs: `logger.warn({ err }, "OpenAI analysis failed — using logic engine results only")`
- The log includes the full error object for debugging (status code, error type, message)

### Mitigation

**Graceful degradation — the primary mitigation:**
```typescript
let aiResult = { gaps: [], aiSummary: "" }
try {
  aiResult = await analyzeWithAI(prdText, engineReport)
} catch (err) {
  logger.warn({ err }, "OpenAI analysis failed — using logic engine results only")
}
// pipeline continues regardless
```
The logic engine results are stored in the database and returned as HTTP 201. The user gets a complete analysis with all structural gaps — just without the AI semantic layer.

**User experience on fallback:** The analysis detail page renders normally. The AI Summary card is conditionally rendered (`aiSummary && <AISummaryCard>`), so it simply doesn't appear. Gap cards with `source: "ai"` are absent, but all logic engine gaps are present. The experience degrades gracefully without an error state.

**Future improvement:** Queue failed AI analyses for async retry. Store a `ai_status: "pending" | "complete" | "failed"` column on the analyses table. Show a "AI analysis pending" notice in the UI and update when the retry succeeds.

---

## 7. Database Failure

### Description

The PostgreSQL database is unavailable or a query fails. Common causes:
- Replit's managed PostgreSQL service is temporarily unavailable
- Connection pool exhausted under concurrent load
- Query timeout on a large result set
- Schema mismatch after a failed migration (e.g. missing column)
- Disk space exhaustion on the database server

### Impact

`POST /api/analyses` fails after the logic engine and GPT-4o have already run successfully and expensively. Results are computed but cannot be stored. HTTP 500 is returned to the user. All computation is lost.

`GET /api/analyses/:id` fails — the analysis detail page shows an error state. All previously stored analyses become temporarily inaccessible.

### Detection

- Drizzle ORM throws an error that propagates through the route handler
- The error is caught at route level and returned as HTTP 500 with the error message
- Server logs capture the full PostgreSQL error with stack trace at ERROR level

### Mitigation

**Replit managed PostgreSQL:** Connection management, automatic failover, daily backups, and SSL termination are handled by the platform. The developer does not manage a database server.

**Connection pooling via `pg.Pool`:** The pool manages a configurable number of connections. Individual query failures do not exhaust the pool. Idle connections are recycled automatically.

**Route-level try/catch:** All database operations in the route handlers are implicitly covered by Express 5's async error handling. Uncaught errors in async route handlers propagate to the error middleware and return structured HTTP 500 responses rather than crashing the process.

**Future improvement:** Return the computed analysis result to the user even when database storage fails. Cache the result in memory temporarily and retry storage asynchronously. This converts a "complete failure" into a "degraded — results shown but not saved" state.

---

## 8. Confidence Miscalculation

### Description

The confidence score formula produces a mathematically incorrect result. Examples:
- A PRD with all 8 sections and zero issues scores 45 instead of 100
- A PRD with no sections scores 60 instead of 0
- The grade thresholds are off-by-one (a score of 75 shows as C instead of B)
- Floating-point arithmetic produces a score of 100.0000000001 which doesn't map to any grade

### Impact

The readiness score is the single most important output of the system. PMs make decisions based on it — whether to share the PRD, which gaps to fix first, whether to delay the sprint. A wrong score leads to wrong decisions. This is the highest-impact silent failure because it produces no error, just wrong data.

### Detection

**Deterministic regression tests** — these can be run against `GET /api/engine-test` at any time:

| Test | Input | Expected structureScore | Expected clarityScore | Expected completenessScore | Expected total | Expected grade |
|---|---|---|---|---|---|---|
| TC-28 | Perfect PRD (8/8 sections, 0 ambiguities, 0 issues) | 40 | 30 | 30 | 100 | A |
| TC-29 | Sample weak PRD (3/8 sections, multiple vague words) | 15 | 0 | 0 | 15 | F |
| TC-30 | 4-of-8 sections, 0 ambiguities, 0 issues | 20 | 30 | 30 | 80 | B |
| TC-31 | 0 sections, 0 ambiguities, 0 issues | 0 | 30 | 30 | 60 | C |
| TC-32 | 8 sections, density=1.0, 0 issues | 40 | 0 | 30 | 70 | C |

The API response for `GET /api/engine-test` includes `engineReport.confidence.structureScore`, `clarityScore`, `completenessScore`, and `totalScore` — each component is visible and verifiable.

### Mitigation

**Deterministic formula:** No randomness, no AI, no floating-point model. Same input always produces the same output. Bugs are reproducible and fixable.

**`Math.max(0, ...)` floors:** Every score component uses `Math.max(0, ...)` — scores cannot go negative regardless of how many issues are found. This prevents a PRD with 6 critical issues from scoring -18/30 on completeness.

**`Math.round()` on all outputs:** Eliminates floating-point drift. All three components and the total score are integers.

**Independent components:** A bug in the `clarityScore` calculation cannot affect `structureScore` or `completenessScore`. Each is computed from a different input and stored separately.

**Full breakdown in API response:** The response from both `GET /api/engine-test` and `POST /api/analyses` includes all three sub-scores, not just the total. This makes it possible to identify which component is wrong in a regression.

**Grade boundary table is explicit in source code:** The grade thresholds are not computed — they are explicit `if/else` comparisons in `confidenceCalculator.ts` lines 40–55. A boundary error is immediately visible in the source.
