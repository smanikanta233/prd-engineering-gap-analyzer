# Product Brief — PRD Engineering Gap Analyzer

## 1. Problem Statement

Product managers write PRDs. Engineers read them. Somewhere between the two, critical details fall through the gaps — missing error states, undefined input constraints, ambiguous language like "scalable" or "fast", and absent acceptance criteria that leave QA without a definition of done.

The result is expensive: engineering teams make assumptions, build the wrong thing, or surface blockers in sprint planning that should have been caught weeks earlier. A 2023 study by the Product Development Institute found that 42% of engineering rework is traceable to ambiguous or incomplete requirements.

The PRD Engineering Gap Analyzer solves this at the source — before a single line of code is written.

The core insight is that PRD quality failures fall into two distinct categories:

**Structural failures** — detectable by pattern matching. These are objective: either the "Acceptance Criteria" section is present or it isn't. Either the word "scalable" appears without a measurable definition or it doesn't. A deterministic rule engine can catch these reliably, cheaply, and instantly.

**Semantic failures** — detectable only with domain understanding. An authentication PRD that never mentions brute-force protection is a security hole, but no regex can flag it without understanding the domain. A payment feature that doesn't address chargebacks needs someone who knows fintech. A GDPR-related feature that omits data retention timelines needs regulatory context. This is where AI earns its cost.

The two-layer architecture — logic engine first, GPT-4o second — is the direct response to this problem structure.

---

## 2. User Persona

**Primary persona: Priya S.**

- **Role:** Senior Product Manager at a B2B SaaS company (Series B, ~120 engineers)
- **Experience:** 6 years in product, formerly a QA lead — she understands engineering
- **Tools:** Notion, Jira, Confluence, Slack
- **PRD process:** Writes in Notion, exports to Confluence, shares with engineering lead for review
- **Frustration:** "I write detailed PRDs but engineers always come back with questions I thought I answered. By then we've already started the sprint."
- **Goal:** Ship features with fewer back-and-forths between product and engineering
- **Behaviour:** Reviews PRDs before sharing, runs informal checklists in her head, saves a "common mistakes" doc she built over 3 years
- **Trigger for adoption:** Hears about the tool at a product meetup. Tries it on a PRD she's already submitted. Finds 2 gaps she missed. Becomes an advocate.

**Secondary persona: Engineering Lead / Tech Lead**

- Reviews incoming PRDs during refinement sessions
- Currently does gap-spotting manually, which takes 45–90 minutes per PRD
- Would use the tool as a pre-filter — if a PRD already passed the analyzer, refinement is faster
- Values the "Logic Engine" source badge: deterministic findings they can trust without subjective interpretation

**Who is NOT the user:**
- Junior PMs writing their first PRD — they need a template, not an audit
- Engineers writing technical specs — the tool is tuned for product requirements language
- Large enterprise PMs with dedicated BA teams — they already have a structured review process

---

## 3. Trigger Moment

Priya has just finished writing a PRD for a new checkout flow redesign. It is Sunday evening. The sprint planning meeting is Monday morning. She wants to do a final review before sharing the document with her engineering lead.

She opens the PRD Gap Analyzer, pastes the document, and gets an instant AI audit. The readiness score is 61/100 — Grade C. Three critical gaps appear: missing error handling for failed payment processing, no edge case coverage for the empty cart state, and an undefined notification trigger when an order is placed.

She fixes all three in 25 minutes. On Monday, the refinement session runs 40 minutes faster than usual. Her engineering lead comments that it was "the clearest PRD handoff we've had this quarter."

That experience — the score going from C to A after deliberate iteration — is the product's core value loop.

---

## 4. Jobs to Be Done (JTBD)

| Job | Statement |
|---|---|
| Core job | When I finish writing a PRD, I want to catch engineering gaps before I share it, so I can avoid rework and sprint delays |
| Related job | When I present a PRD to my engineering team, I want to demonstrate thoroughness, so I am taken seriously as a technical PM |
| Emotional job | When I hand off requirements, I want to feel confident that I haven't missed anything obvious, so I don't feel embarrassed in planning |
| Consumption job | When I use a review tool, I want specific, actionable feedback — not vague generic advice like "add more detail" |
| Learning job | When I see my gaps over time, I want to understand my blind spots, so I can write better PRDs without needing the tool for obvious things |

---

## 5. Why AI — The Specific Decision

Pattern-matching rules alone can detect structural gaps deterministically. They handle the structural layer well. But they cannot detect:

**Domain-level risks:** An authentication PRD with zero mention of password encryption or brute-force rate limiting is a security failure. Detecting this requires knowing that authentication systems need those properties — not just scanning for keywords.

**Business logic contradictions:** A pricing model that references both "free tier" and "all features included" in different sections without reconciling the contradiction requires semantic reasoning to identify as contradictory.

**Missing user journey steps:** A checkout flow PRD that covers the happy path but never addresses the empty cart state, the expired session state, or the out-of-stock state has real gaps that a PM will have thought through verbally but never written down.

**Compliance gaps:** A data deletion feature that doesn't mention GDPR's right-to-erasure requirements or data retention timelines is a legal risk. This requires knowledge of regulatory context.

**Integration risks:** A PRD that depends on a third-party payment processor without mentioning webhook handling, idempotency, or reconciliation has a real engineering gap that requires domain knowledge to see.

The two-layer architecture is the explicit answer: use the logic engine for what rules do well (structural, fast, free, reproducible), and use GPT-4o for what AI does well (semantic, contextual, domain-aware). Critically, GPT-4o does not receive the raw PRD — it receives a structured EngineReport showing everything already caught. This prevents the AI from repeating rule-based findings and forces it to add genuine semantic value.

---

## 6. Feature List + Value vs Effort Analysis

### Core Analysis Features

| Feature | Description | User Value | Build Effort | Priority |
|---|---|---|---|---|
| Section detector | Checks 8 required PRD sections via regex | High — most common PRD failure | Low | P0 |
| Ambiguity detector | 12 rule categories, 40+ vague words | High — "fast/scalable" are the top PM mistake | Low | P0 |
| Missing logic detector | 7 conditional checks (error handling, auth, rollback…) | High — catches hidden engineering blockers | Medium | P0 |
| Undefined input detector | 7 checks (file types, validation, pagination…) | High — prevents scope creep and sprint blockers | Medium | P0 |
| Confidence score (0–100, A–F) | Deterministic formula, fully explainable | High — single number to track improvement | Medium | P0 |
| GPT-4o semantic layer | Domain-level gap detection on top of logic engine | Very high — catches what rules can't | Medium | P0 |
| Gap merger + dedup | Merges both sources, deduplicates, caps at 15 | Medium — prevents noise | Medium | P1 |
| Source tagging | Every gap marked "Logic Engine" or "AI Detected" | High — transparency and trust calibration | Low | P0 |
| Actionable recommendations | Every gap includes specific fix guidance | High — actionable output vs vague warnings | Low | P0 |

### Results UI Features

| Feature | User Value | Build Effort | Priority |
|---|---|---|---|
| Readiness score card (circular gauge + grade badge) | High — immediate visual summary | Medium | P0 |
| AI summary card (GPT-4o 2–3 sentence assessment) | Medium — narrative context | Low | P1 |
| Section coverage panel (8-section grid, ✓/✗) | High — visual gap map | Low | P1 |
| Gap cards with severity badges + confidence bar | High — visual hierarchy for prioritisation | Medium | P0 |
| Source badge per gap (blue/purple) | High — trust calibration | Low | P0 |
| Recommendation callout per gap | High — actionable without leaving the tool | Low | P0 |
| Filter by severity (Critical/High/Medium/Low) | Medium — focus on what matters | Low | P1 |
| Export gaps as JSON | Low for PM, high for engineering integration | Low | P2 |
| Thumbs up/down feedback | Medium — future model improvement signal | Low | P2 |

### History & Management Features

| Feature | User Value | Build Effort | Priority |
|---|---|---|---|
| Analysis history with search + filter | Medium — track PRD improvement over time | Low | P1 |
| Coloured left-border cards (red/amber/green) | Medium — at-a-glance quality signal | Low | P1 |
| Delete analyses with confirmation | Low — hygiene | Low | P2 |

### Admin Dashboard Features

| Feature | User Value | Build Effort | Priority |
|---|---|---|---|
| Aggregate stats (total analyses, gaps, feedback) | Low for PM, high for demo/portfolio | Medium | P2 |
| Severity distribution chart | Medium — identifies common PRD weaknesses | Medium | P2 |
| Gap type breakdown table | Medium — identifies systematic blind spots | Medium | P2 |
| Feedback summary table | Low — signals helpfulness rate per category | Low | P2 |

---

## 7. Failure Mode Analysis (Summary)

The system has 8 identified failure modes. Full details in `docs/failure-mode-analysis.md`.

| Failure Mode | Severity | Primary Mitigation |
|---|---|---|
| Over-flagging | High | MAX_TOTAL_GAPS=15, MIN_CONFIDENCE=0.65, MAX_AI_GAPS=10, dedup |
| Under-flagging | Critical | Two-layer architecture; 14 independent checks total |
| AI hallucinations | High | temperature=0.2, confidence filter, source badges, feedback loop |
| Duplicate findings | Medium | Word-overlap dedup (>50% on words >4 chars) + system prompt |
| Invalid JSON from GPT-4o | Medium | Pre-clean strip, response_format: json_object, graceful fallback |
| OpenAI API failure | Medium | Graceful degradation — returns logic engine results as HTTP 201 |
| Database failure | High | Replit managed DB, connection pooling, try/catch at route level |
| Confidence miscalculation | Critical | Deterministic formula, Math.max floors, Math.round, regression tests |

The most important single mitigation in the system is the **graceful degradation on OpenAI failure**. Because the logic engine runs first and the AI layer is wrapped in try/catch, an OpenAI outage degrades the product to "logic engine only" rather than causing a complete failure. Users still get a useful analysis.

---

## 8. AI Trade-Offs and Constraints

### What GPT-4o Does Well in This Context

- Identifies domain-specific gaps (security, compliance, fintech, healthcare) that require trained knowledge
- Detects narrative inconsistencies between different sections of the PRD
- Flags missing user journey steps by understanding what "checkout flow" implies
- Writes specific, actionable recommendations in natural language
- Adapts its analysis to the PRD's domain without being explicitly told what domain it is

### What GPT-4o Does Poorly in This Context

- **Consistency:** Two runs of the same PRD may produce different gaps even at temperature=0.2. The logic engine results are deterministic; the AI results are not.
- **Hallucination at scale:** On longer PRDs with many existing gaps, GPT-4o sometimes invents gaps that the PRD explicitly addresses. The confidence filter and source badges mitigate this but cannot eliminate it.
- **Latency:** GPT-4o adds 3–8 seconds to every analysis. For a PM running multiple iterations on a PRD, this adds up. The logic engine alone (~11ms) would be preferable for rapid iteration.
- **Cost:** At $0.005–0.015 per analysis (rough estimate based on input/output token counts), cost scales linearly with usage. At 1,000 analyses/month, this is $5–15/month in API costs.

### Deliberate Trade-offs Made

**GPT-4o over GPT-4o-mini:** The analysis quality difference is significant for domain-specific gap detection. GPT-4o-mini saves ~80% of cost but misses compliance and security gaps at a higher rate. For a PRD review tool, false negatives are more expensive than API costs.

**Temperature 0.2 over 0:** Temperature 0 produces maximally deterministic output but can be excessively conservative — it repeats the same pattern-matched findings rather than reasoning across the document. Temperature 0.2 allows enough variation to reason about different aspects of the PRD while staying grounded.

**MAX_AI_GAPS=10 over unlimited:** Without a cap, GPT-4o can produce 20–30 gaps on a complex PRD. Most of the long tail are speculative low-confidence findings. Capping at 10 forces the model to surface its highest-confidence findings and prevents the 15-gap total cap from being entirely consumed by AI output.

**Structured context over raw PRD:** Sending the EngineReport summary to GPT-4o alongside the PRD increases token usage by ~30% compared to sending the raw PRD alone. The quality improvement — fewer duplicates, more focused semantic gaps — justifies the cost.

---

## 9. Cost, Sustainability, and Production Considerations

### API Cost Model

| Component | Cost per analysis | Cost at 100 analyses/month |
|---|---|---|
| Logic engine | $0.00 | $0.00 |
| GPT-4o (est. 2,000 input + 500 output tokens) | ~$0.013 | ~$1.30 |
| PostgreSQL (Replit managed) | Included in Replit plan | $0.00 |
| Compute (Replit deployment) | Included in Replit plan | $0.00 |

At moderate usage (< 500 analyses/month), OpenAI API costs stay under $7/month. At 10,000 analyses/month (SaaS scale), costs approach $130/month — still manageable but requiring per-user pricing.

### Scaling Considerations

**Current architecture limitations:**
- POST /api/analyses blocks for 3–8 seconds waiting for GPT-4o. Under concurrent load (10+ simultaneous submissions), this creates a queue. Express 5 handles this via its async event loop but response times degrade.
- No rate limiting on POST /api/analyses — a single user could exhaust the OpenAI API key quota by submitting hundreds of analyses rapidly.
- The gap list is not paginated — an analysis with 15 gaps returns all 15 in a single response. At scale with many analyses, `GET /api/analyses` returns all analyses in one query with no limit.

**Production improvements needed before SaaS launch:**
1. Async analysis processing — return a job ID immediately, poll for results
2. Rate limiting — max N analyses per IP per hour
3. User authentication — per-user analysis history and quota management
4. Pagination on `GET /api/analyses`
5. Retry logic for OpenAI failures with exponential backoff
6. A/B test GPT-4o-mini vs GPT-4o on a sample of analyses to quantify the quality/cost trade-off

### Sustainability of the Two-Layer Approach

The logic engine is indefinitely sustainable — no external dependencies, no API cost, no model deprecation risk. If OpenAI deprecates GPT-4o or changes pricing dramatically, the logic engine results remain fully functional as the product's core value. The AI layer is an enhancement, not a dependency.

---

## 10. Reflection — What Was Learned Building This

### Technical Insights

**The gap merger was harder than anticipated.** The first version used exact string matching for deduplication and missed near-duplicates. The second version used any word overlap and was too aggressive — it dropped AI gaps that were genuinely different but happened to share a common word like "error." The final version with a 4-character minimum word length filter and 50% overlap threshold is correct but took three iterations to arrive at.

**Deterministic scoring is a feature, not a limitation.** The original design considered using GPT-4o to score PRDs holistically. The decision to use a deterministic formula instead was the right call — PMs trust a score they can trace back to specific, fixable issues. An AI score feels arbitrary and cannot be improved in a predictable way.

**The system prompt is a first-class engineering artifact.** The quality of GPT-4o's output is heavily determined by the system prompt. The instruction to "not repeat logic engine findings" and the explicit listing of already-detected issues in the user prompt were the two changes that most improved output quality. Prompt engineering deserves the same rigor as code review.

**Graceful degradation should be designed in from the start.** Adding the OpenAI fallback after the fact would have required restructuring the route handler. Building it in from the first version of `POST /api/analyses` cost almost nothing and makes the system dramatically more reliable.

### Product Insights

**PMs care more about actionability than comprehensiveness.** Early testing revealed that a gap list with vague descriptions ("missing requirements") was ignored, while specific descriptions with concrete recommendations were acted on immediately. Every gap has both a description of what is wrong and a specific, implementable recommendation.

**The grade (A–F) is more motivating than the score (0–100).** When shown a score of 67/100, users shrug. When shown Grade C with the label "Needs Work," they immediately want to get to a B. The grade creates an intrinsic motivation to iterate that the raw number does not.

**Source transparency builds trust.** The decision to label every gap as "Logic Engine" or "AI Detected" was initially a technical decision (needed for analytics). It turned out to be the single most important UX decision in the product. Users apply different levels of trust to the two sources — logic engine findings are treated as facts, AI findings are treated as recommendations. This calibration is correct and valuable.
