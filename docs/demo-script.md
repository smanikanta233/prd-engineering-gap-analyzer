# Demo Script — PRD Engineering Gap Analyzer

---

## 30-Second Elevator Pitch

> "I built an AI-powered tool that reviews Product Requirements Documents before they reach engineering teams.
>
> Most PRD quality tools are just checklists. Mine is different — it runs a deterministic logic engine first, checking for missing sections, vague language, undefined inputs, and logical gaps in about 10 milliseconds with no AI cost. Then it sends a structured diagnostic report to GPT-4o to catch the semantic gaps that pattern matching can't find — things like missing security specs or GDPR compliance gaps.
>
> The output is a readiness score from 0 to 100, an A-to-F grade, and up to 15 prioritised gaps with specific recommendations. Every gap is tagged as either 'Logic Engine' or 'AI Detected' so the PM knows exactly what to trust and why.
>
> It's built on React, Express, TypeScript, PostgreSQL, and GPT-4o — deployed and live right now."

---

## 5-Minute Demo Script

### Minute 1 — Context (30 seconds talking, 30 seconds showing home page)

> "This is the PRD Engineering Gap Analyzer. The problem it solves: PMs write requirements, engineers find the gaps during sprint planning — too late. This tool catches gaps before the PRD is shared."

*Show the home page. Point out the hero description, the System Metrics sidebar showing stats from previous analyses.*

> "You can see from the metrics we've already run [N] analyses. Let me run a new one now."

---

### Minute 2 — Submit a PRD

*Paste the "User Profile Management — Mobile App v2.1" PRD into the form. Set the title. Click Run Gap Analysis.*

> "While it's analysing, let me explain what's happening. First, a deterministic logic engine runs — no AI, no API call — in about 10 milliseconds. It checks for 8 required sections, scans every line for vague words, checks for missing error handling, and detects undefined input constraints. Only after that does it call GPT-4o — and it doesn't send the raw PRD. It sends a structured diagnostic report so the AI adds value instead of repeating what we already know."

*Multi-step loader should be visible: Logic engine → Detecting ambiguities → Sending to GPT-4o → Merging findings.*

---

### Minute 3 — Readiness Score

*Analysis detail page loads.*

> "The first thing you see is the readiness score. This PRD scored [X] out of 100 — Grade [X]. That's [interpretation text]. Notice this score is fully deterministic — no AI involved. Same PRD, same score, every time. That matters because PMs need to iterate and see the score improve predictably."

*Point out the progress bar, grade badge, 3 mini stats (sections found, issues, processing time).*

> "The logic engine ran in [N] milliseconds. Then GPT-4o added [N] additional gaps on top."

---

### Minute 4 — Gap Cards

*Scroll through the gap list.*

> "Each gap has a severity badge — Critical in red, High in amber. Every gap shows whether it came from the Logic Engine in blue, or from AI in purple. This transparency is important — the PM can trust the Logic Engine findings completely, and apply appropriate scrutiny to the AI findings."

*Point to a recommendation callout.*

> "Every gap comes with a specific, actionable recommendation. Not just 'you're missing error handling' but exactly what to add and why."

*Click a filter — show Critical only.*

> "You can filter to just Critical gaps. For this PRD there are [N] — those are the blockers that must be fixed before engineering starts."

---

### Minute 5 — Section Coverage + Export + History

*Scroll to section coverage panel.*

> "Below the PRD text is the section coverage panel — a visual map of which of the 8 required sections are present. Green checkmark means found, red X means missing."

*Click Export JSON.*

> "Engineering teams can export the gaps as JSON — useful for integrating with Jira or Linear ticket creation."

*Navigate to History.*

> "Every analysis is saved. The coloured left border tells you at a glance — red means the PRD has critical gaps, amber means high gaps, green means it's clean. Search and filter work in real time."

---

## 8-Minute Evaluator Walkthrough

Use the 5-minute demo above for minutes 1–5, then add:

---

### Minute 6 — Admin Dashboard

*Navigate to /admin.*

> "The admin dashboard shows aggregate statistics across all analyses. Severity distribution shows where most gaps cluster — in this case, [critical/high] gaps dominate. The Gap Type Breakdown table shows which gap categories appear most often and with what average confidence."

*Point to Feedback Summary.*

> "The feedback table will populate as users rate gaps as helpful or not helpful. This data can be used to improve the logic engine rules over time — if 'Missing Rate Limiting' is consistently marked not helpful, we know to tune that rule."

---

### Minute 7 — Logic Engine Test Endpoint

*Open browser and navigate to /api/engine-test.*

> "Here's something that shows the architecture clearly. This endpoint runs just the logic engine — no GPT-4o — on a built-in weak sample PRD. You can see the full EngineReport: section detection results, every ambiguity finding with line number, every missing logic finding, every undefined input finding, and the confidence breakdown showing exactly how the score was calculated."

*Point to processingTimeMs.*

> "11 milliseconds. That's the entire deterministic layer, zero API cost. Compare that to the 3–8 seconds for the full pipeline with GPT-4o."

---

### Minute 8 — Architecture Explanation

> "Let me summarise the architecture. The frontend is React 19 with Vite and TypeScript. The backend is Express 5 with TypeScript and Drizzle ORM on PostgreSQL. The logic engine is a service layer with 9 files — preprocessor, 4 detectors, confidence calculator, report builder, types, and orchestrator. The OpenAI integration is isolated in its own service so it can be swapped out or disabled. The gap merger is a separate module with deduplication, sorting, and over-flagging protection built in."

> "The key architectural decision: the logic engine runs first, and GPT-4o receives the structured EngineReport as context, not the raw PRD. This means GPT-4o adds genuine value instead of repeating structural checks. It also means the system degrades gracefully — if OpenAI is unavailable, the logic engine results are returned on their own."
