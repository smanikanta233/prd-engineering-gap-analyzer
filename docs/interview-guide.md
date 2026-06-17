# Interview Guide — PRD Engineering Gap Analyzer

Prepared answers for technical evaluator and recruiter questions about this project.

---

## "Why did you use AI for this? Couldn't you just use rules?"

Rules alone get you about 60% of the way there. The logic engine in this system uses deterministic pattern matching to catch structural gaps — missing sections, vague words, undefined file upload constraints, missing validation rules. These checks are fast (11ms), free (no API cost), reproducible, and explainable. They handle the structural layer well.

But rules cannot detect semantic gaps. An authentication PRD with zero mention of password encryption or brute force protection is a critical security failure. A checkout PRD that never addresses the empty cart state has a missing user journey. A data deletion feature without GDPR retention policy is a compliance risk. These require contextual understanding and domain knowledge — which is what GPT-4o provides.

The two-layer architecture is the deliberate answer to "why not just rules": use rules for what rules do well (structural, deterministic, fast, free), use AI for what AI does well (semantic, contextual, domain-aware). Neither layer alone is sufficient.

---

## "Why not just use AI for everything?"

Three reasons:

**Cost.** Running GPT-4o on every analysis costs money. The logic engine runs in 11ms for free. By running logic first, we give GPT-4o a pre-filtered, enriched context — it can focus on semantic gaps instead of rechecking whether the word "fast" is vague. This makes the AI layer cheaper and better.

**Reliability.** If the OpenAI API is down, the system still works — it returns logic engine results. If GPT-4o hallucinates, the logic engine results are still present and clearly sourced. Mixing everything into a single AI call means one point of failure.

**Explainability.** When a PM asks "why did my PRD score 42/100?", the deterministic scoring formula gives a specific, auditable answer. "The AI said so" is not acceptable for a tool that PMs are supposed to trust with their career decisions.

---

## "Why have a confidence score? Why not just list the gaps?"

Because not all gaps are equally certain. A "Missing Section" finding (confidence 0.99) is a hard fact — either the acceptance criteria section exists or it doesn't. A GPT-4o finding about "missing GDPR compliance" (confidence 0.78) is a probabilistic inference based on the AI's understanding of the domain.

Without a confidence score, the PM has no way to prioritise which gaps to fix first. With confidence scores, they can act on the 0.99-confidence critical gaps immediately and exercise more judgment on the 0.70-confidence medium gaps.

The confidence score also enables the over-flagging protection — gaps below 0.65 confidence are filtered out entirely before reaching the user. This keeps the output clean and trustworthy.

---

## "Why run the logic engine before GPT-4o? Why not just send the PRD directly to the AI?"

Two reasons:

**Better AI output.** When the user prompt includes the full EngineReport — every structural finding already caught — GPT-4o knows not to repeat them. It focuses exclusively on semantic and domain-level gaps. The output quality is higher because the AI is not wasting its context window on things a regex already caught.

**Richer context.** GPT-4o receives the PRD plus a structured diagnostic: which sections are present, what ambiguities were found, what the confidence score is. This context helps it make better inferences. An AI reading "confidence score: 15/100, grade F, missing 5 sections" understands immediately that this is a weak PRD and adjusts its analysis accordingly.

In a demo or interview, the key statement is: *"We don't send raw PRDs to AI. We send structured diagnostic reports."* That distinction is what separates this from a simple ChatGPT wrapper.

---

## "Why PostgreSQL? The spec said SQLite."

The original assignment spec suggested SQLite. I chose PostgreSQL for three reasons:

**Production readiness.** Replit provides managed PostgreSQL with connection pooling, automated backups, and failover. SQLite is a file-based database — fine for local development but not appropriate for a deployed web application with concurrent requests.

**JSON storage.** The `engine_report` column stores the full EngineReport as a JSON string. PostgreSQL handles this reliably at scale. Future iterations could migrate this column to JSONB to support querying nested fields (e.g. find all analyses with confidence score below 40) without schema migrations.

**Portfolio value.** PostgreSQL is the most commonly used relational database in production SaaS environments. Demonstrating Drizzle ORM + PostgreSQL with proper schema design, connection pooling, and typed queries is more valuable on a CV than an SQLite file.

The decision to use PostgreSQL over SQLite was a deliberate deviation from the spec, made for sound technical reasons. I would make the same decision again.

---

## "What was your biggest technical challenge?"

The gap merger deduplication logic was the hardest problem to get right.

The first version of the merger was too aggressive — it dropped AI gaps that were genuinely different from logic engine findings but shared a few common words. The word "error" appears in both "Missing Error Handling" (logic engine) and "Database Error Recovery Strategy" (AI) — but these are different gaps about different things.

The solution was to use a word-level overlap ratio with a 4-character minimum word length filter. Short words like "the", "is", "of" don't count toward overlap. Only meaningful content words count. And the overlap threshold is 50% — not exact match, not any overlap, but majority overlap. This correctly preserves distinct findings while dropping true duplicates.

The second challenge was the confidence score formula. The initial version didn't floor at zero — a PRD with many critical issues could produce a negative score. Adding `Math.max(0, ...)` to each component fixed this, but it also exposed a new problem: once a component hits zero, additional issues have no marginal effect. The solution was to document this as intentional — once a PRD fails a whole dimension completely, the score for that dimension is zero regardless of how many more issues exist. The grade communicates the magnitude.

---

## "If you had more time, what would you add to this project?"

**High priority:**
- User authentication — currently the tool is anonymous. Multi-user support with personal analysis history would make it a real SaaS product
- PRD template library — dropdown to pre-fill the textarea with templates for API features, UI features, data pipeline features, etc.
- Jira/Linear integration — export gaps directly as tickets with severity mapped to priority
- Improvement tracking — resubmit a revised PRD and show score improvement delta vs the previous version

**Medium priority:**
- Batch analysis — upload multiple PRDs and get a portfolio-level readiness report
- Custom rule sets — let teams add their own ambiguity rules and section requirements
- Slack integration — share analysis results directly to a Slack channel

**Architecture improvements:**
- Async processing — for long PRDs, return a job ID immediately and poll for results instead of waiting for the full pipeline
- Retry queue — if OpenAI fails, queue the AI analysis for retry and return logic engine results immediately
- Rate limiting on the API — currently there is no per-user or per-IP rate limiting on POST /api/analyses

**Longer term:**
- Fine-tune a smaller model on PRD gap detection — reduce dependency on GPT-4o, lower latency, lower cost
- Feedback-driven rule improvement — use thumbs-down data to automatically flag underperforming rules for review
