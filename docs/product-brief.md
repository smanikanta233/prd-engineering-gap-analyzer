# Product Brief — PRD Engineering Gap Analyzer

## Problem Statement

Product managers write PRDs. Engineers read them. Somewhere between the two, critical details fall through the gaps — missing error states, undefined input constraints, ambiguous language like "scalable" or "fast", and absent acceptance criteria that leave QA without a definition of done.

The result is expensive: engineering teams make assumptions, build the wrong thing, or surface blockers in sprint planning that should have been caught weeks earlier. A 2023 study by the Product Development Institute found that 42% of engineering rework is traceable to ambiguous or incomplete requirements.

The PRD Engineering Gap Analyzer solves this at the source — before a single line of code is written.

---

## User Persona

**Name:** Priya S.  
**Role:** Senior Product Manager at a B2B SaaS company (Series B, ~120 engineers)  
**Experience:** 6 years in product, previously a QA lead  
**Tools:** Notion, Jira, Confluence, Slack  
**Frustration:** "I write detailed PRDs but engineers always come back with questions I thought I answered. By then we've already started the sprint."  
**Goal:** Ship features with fewer back-and-forths between product and engineering.  
**Behaviour:** Reviews PRDs before sharing, runs informal checklists in her head, wishes there was a tool that could tell her what she missed.

**Secondary persona:** Engineering Lead / Tech Lead who reviews incoming PRDs and currently does gap-spotting manually during refinement sessions.

---

## Trigger Moment

Priya has just finished writing a PRD for a new checkout flow redesign. It is Sunday evening. The sprint planning meeting is Monday morning. She wants to do a final review before sharing the document with her engineering lead.

She opens the PRD Gap Analyzer, pastes the document, and gets an instant AI audit. She fixes three critical gaps before the meeting. Monday's refinement session runs 40 minutes faster than usual.

---

## Jobs to Be Done (JTBD)

| Job | Statement |
|---|---|
| Core job | When I finish writing a PRD, I want to catch engineering gaps before I share it, so I can avoid rework and sprint delays |
| Related job | When I present a PRD to my engineering team, I want to demonstrate thoroughness, so I am taken seriously as a technical PM |
| Emotional job | When I hand off requirements, I want to feel confident that I haven't missed anything obvious, so I don't feel embarrassed in planning |
| Consumption job | When I use a review tool, I want it to give me specific, actionable feedback, not vague generic advice |

---

## Why AI

Pattern-matching rules alone can detect structural gaps (missing sections, vague words) deterministically. But they cannot detect:

- **Domain-level risks** — An authentication PRD that never mentions password encryption is a security failure that requires contextual understanding to identify
- **Business logic contradictions** — A pricing model that references both "free tier" and "all features included" requires semantic reasoning to flag as contradictory
- **Missing user journey steps** — A checkout flow that skips the empty cart state requires narrative understanding of user flows
- **Compliance gaps** — A data deletion feature that doesn't mention GDPR retention policies requires knowledge of regulatory context

The two-layer architecture — deterministic logic engine first, GPT-4o second — gives us the best of both: fast, explainable, reproducible structural checks plus deep semantic analysis that only AI can provide.

---

## Success Metrics

| Metric | Target | Measurement |
|---|---|---|
| Gaps detected per PRD | 5–15 (average 8) | Database aggregate |
| Critical gaps caught rate | >90% of genuinely critical gaps in test PRDs | Manual evaluation |
| False positive rate | <15% of flagged gaps rated "not helpful" | Feedback thumbs down / total |
| Analysis completion time | <15 seconds end-to-end | processingTimeMs + OpenAI latency |
| Readiness score accuracy | Score correlates with actual rework rate | Post-launch survey |
| Confidence score reliability | High-confidence gaps (>0.85) are helpful >90% of time | Feedback data |

---

## Feature List

### Core Analysis
- Deterministic logic engine with 4 detectors (section, ambiguity, missing logic, undefined inputs)
- GPT-4o semantic gap detection on top of logic engine findings
- Confidence score 0–100 with grade (A–F) and human-readable interpretation
- Gap merger with deduplication and over-flagging protection (max 15 gaps)
- Source tagging: every gap labelled "Logic Engine" or "AI Detected"
- Actionable recommendations on every gap

### Results UI
- Readiness score card with circular gauge, grade badge, progress bar
- AI summary card (GPT-4o 2–3 sentence assessment)
- Gap cards with severity badges, confidence bar, recommendation callout
- Section coverage panel (8 sections, green ✓ / red ✗)
- Filter by severity (Critical / High / Medium / Low)
- Sort by severity or confidence
- Export gaps as JSON
- Thumbs up/down feedback per gap

### History & Management
- Analysis history with search, filter, and sort
- Coloured left border cards (red = critical, amber = high, green = clean)
- Delete analyses with confirmation
- Breadcrumb navigation

### Admin Dashboard
- Total analyses, total gaps, avg gaps per PRD, total feedback
- Severity distribution with coloured progress bars
- Gap type breakdown table with avg confidence per category
- All analyses table with search
- Feedback summary table

---

## Value vs Effort Analysis

| Feature | User Value | Build Effort | Priority |
|---|---|---|---|
| Section detector | High — catches most common PRD failures | Low — regex patterns | P0 |
| Ambiguity detector | High — "fast/scalable" are the most common PM mistakes | Low — word list matching | P0 |
| Confidence score | High — gives PM a single number to track improvement | Medium — formula design | P0 |
| Missing logic detector | High — catches hidden engineering blockers | Medium — conditional logic | P0 |
| GPT-4o integration | Very high — catches domain/semantic gaps rules can't | Medium — prompt engineering | P0 |
| Gap merger + dedup | Medium — prevents noise | Medium — overlap detection | P1 |
| Analysis history | Medium — enables tracking PRD improvement over time | Low — standard CRUD | P1 |
| Admin dashboard | Low for end user, high for demo/portfolio | Medium — aggregate queries | P2 |
| Export JSON | Low for PM, high for engineering team integration | Low — client-side download | P2 |
| Feedback (thumbs) | Medium — enables future model improvement | Low — single endpoint | P2 |
