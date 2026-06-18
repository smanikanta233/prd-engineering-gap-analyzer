# System Architecture — PRD Engineering Gap Analyzer

## Overview

The system is built as a **pnpm monorepo** with two deployable artifacts (frontend and backend) and three shared libraries. Everything runs on Replit with a managed PostgreSQL database. The architecture is designed around a two-layer analysis pipeline: a deterministic logic engine that runs first at near-zero cost, followed by a GPT-4o semantic layer that adds value the rules cannot provide.

The key design principle throughout is **graceful degradation** — every layer of the system can fail independently without taking down the whole pipeline. If GPT-4o is unavailable, logic engine results are returned. If the database fails, the error is caught and returned cleanly. If the PRD is too short, the analysis still runs rather than rejecting the input.

---

## Repository Structure

```
prd-engineering-gap-analyzer/
├── artifacts/
│   ├── api-server/                    # Express 5 backend (TypeScript, port 5000)
│   │   └── src/
│   │       ├── routes/
│   │       │   └── analyses.ts        # All 9 API endpoints
│   │       ├── services/
│   │       │   ├── logic-engine/      # 9-file deterministic engine
│   │       │   │   ├── index.ts
│   │       │   │   ├── types.ts
│   │       │   │   ├── prdPreProcessor.ts
│   │       │   │   ├── sectionDetector.ts
│   │       │   │   ├── ambiguityDetector.ts
│   │       │   │   ├── missingLogicDetector.ts
│   │       │   │   ├── undefinedInputDetector.ts
│   │       │   │   ├── confidenceCalculator.ts
│   │       │   │   └── engineReport.ts
│   │       │   ├── openai/
│   │       │   │   └── prdAnalyzer.ts # GPT-4o integration
│   │       │   └── gapMerger.ts       # Dedup + sort + cap
│   │       └── lib/
│   │           ├── logger.ts          # pino structured logger
│   │           └── openai.ts          # OpenAI SDK singleton
│   └── prd-analyzer/                  # React 19 + Vite frontend
│       └── src/
│           ├── pages/
│           │   ├── home.tsx           # PRD form + dashboard
│           │   ├── analysis.tsx       # Analysis detail (700 lines)
│           │   ├── history.tsx        # All past analyses
│           │   └── admin.tsx          # Aggregate admin view
│           └── components/
│               ├── AppHeader.tsx
│               └── ui/                # 55 shadcn/ui components
├── lib/
│   ├── db/                            # Drizzle ORM schema + PostgreSQL client
│   │   └── src/schema/analyses.ts    # 3 tables: analyses, gaps, feedback
│   ├── api-zod/                       # Shared Zod validation schemas (generated)
│   └── api-client-react/              # Generated React Query hooks (Orval)
└── docs/                              # Documentation (8 files)
```

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          USER BROWSER                            │
│  React 19 · Vite · TypeScript · TailwindCSS v4 · shadcn/ui     │
│  Pages: Home · History · Analysis Detail · Admin                │
│  State: React Query v5 (server state) · Wouter (routing)        │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/JSON
                             │ (React Query mutations + queries)
┌────────────────────────────▼────────────────────────────────────┐
│                       REPLIT REVERSE PROXY                       │
│  Path-based routing: /api → api-server · / → prd-analyzer       │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      EXPRESS 5 BACKEND                           │
│  TypeScript · Drizzle ORM · pino logger · Zod validation        │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                LOGIC ENGINE (deterministic)                │  │
│  │  ~3–15ms · zero API cost · always runs                    │  │
│  │                                                            │  │
│  │  preProcessPRD → detectSections → detectAmbiguity         │  │
│  │  → detectMissingLogic → detectUndefinedInputs             │  │
│  │  → calculateConfidence → buildEngineReport                │  │
│  └─────────────────────────┬─────────────────────────────────┘  │
│                             │ EngineReport                       │
│  ┌─────────────────────────▼─────────────────────────────────┐  │
│  │                OPENAI SERVICE (semantic)                    │  │
│  │  ~3–8 seconds · graceful fallback on failure               │  │
│  │                                                            │  │
│  │  Receives: PRD text + structured EngineReport              │  │
│  │  Returns: AIGap[] + aiSummary string                       │  │
│  └─────────────────────────┬─────────────────────────────────┘  │
│                             │ AIGap[]                            │
│  ┌─────────────────────────▼─────────────────────────────────┐  │
│  │                     GAP MERGER                              │  │
│  │  Deduplicates (>50% word overlap) · sorts by severity      │  │
│  │  · caps at MAX_TOTAL_GAPS = 15                             │  │
│  └─────────────────────────┬─────────────────────────────────┘  │
│                             │ UnifiedGap[]                       │
└─────────────────────────────┼───────────────────────────────────┘
                              │ Drizzle ORM
┌─────────────────────────────▼───────────────────────────────────┐
│                 POSTGRESQL (Replit managed)                       │
│  Tables: analyses · gaps · feedback                              │
│  Connection: pg.Pool · SSL · env: DATABASE_URL                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      OPENAI API (external)                        │
│  Model: gpt-4o · temperature: 0.2 · max_tokens: 2000            │
│  response_format: { type: "json_object" }                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend Flow

```
User opens app (/)
        │
        ▼
Home page loads (two parallel fetches)
├── GET /api/analyses/summary → System Metrics sidebar
│   └── totalAnalyses, totalGaps, avgConfidence, severityBreakdown
├── GET /api/analyses → Recent Analyses list (last 5 shown)
└── PRD submission form (Title input + PRD textarea)

User fills form + clicks "Run Gap Analysis"
        │
        ▼
React Query mutation: POST /api/analyses
        │
        ▼
Multi-step loading UI (simulated progress)
├── t=0ms    "Running logic engine..."
├── t=900ms  "Detecting ambiguities..."
├── t=2000ms "Sending to GPT-4o..."
└── t=3500ms "Merging findings..."

On success (HTTP 201)
        │
        ▼
navigate("/analysis/:id")
        │
        ▼
Analysis Detail page loads
├── Left panel: Original PRD text (scrollable)
├── Right panel:
│   ├── ReadinessCard
│   │   ├── Circular ring gauge (totalScore / 100)
│   │   ├── Grade badge (A/B/C/D/F with colour)
│   │   ├── Progress bar (0–100)
│   │   └── 3 mini-stats: sections detected · issues found · processing time
│   ├── AISummaryCard (purple left border, GPT-4o badge)
│   │   └── Conditional: only shown when aiSummary is non-empty
│   ├── SectionCoveragePanel
│   │   └── 8-section grid: green ✓ / red ✗ per section
│   └── Gap list
│       ├── Filter buttons: All · Critical · High · Medium · Low
│       ├── Sort: Severity · Confidence
│       ├── Export JSON button
│       └── Gap cards (one per gap):
│           ├── Severity badge (colour-coded)
│           ├── Source badge: "Logic Engine" (blue) / "AI Detected" (purple)
│           ├── Description text
│           ├── ConfidenceBar (80×6px inline bar)
│           ├── Recommendation callout (border-top section)
│           └── Thumbs up / thumbs down feedback buttons
```

---

## Backend Flow

```
POST /api/analyses
        │
        ▼
1. Zod validation (CreateAnalysisBody)
   ├── title: string, minLength 3
   └── prdText: string, minLength 50
   On failure → HTTP 400 { error: "..." }
        │
        ▼
2. runLogicEngine(prdText)
   └── ~3–15ms, synchronous, no external calls
   Returns: EngineReport
        │
        ▼
3. analyzeWithAI(prdText, engineReport)      ← wrapped in try/catch
   └── ~3–8 seconds, calls OpenAI API
   On failure → aiResult = { gaps: [], aiSummary: "" }
   Returns: { gaps: AIGap[], aiSummary: string }
        │
        ▼
4. mergeGaps(engineReport, aiResult.gaps)
   └── Dedup + sort + cap at 15
   Returns: UnifiedGap[]
        │
        ▼
5. db.insert(analysesTable)
   └── stores: prdText, title, engineReport (JSON string), aiSummary
   Returns: { id: number, ... }
        │
        ▼
6. db.insert(gapsTable) — bulk insert
   └── one row per UnifiedGap, linked via analysisId
   Skipped if mergedGaps.length === 0
        │
        ▼
7. HTTP 201 response
   └── Full analysis object: id, title, prdText, engineReport (parsed),
       aiSummary, gaps[], createdAt
```

---

## Logic Engine Flow

```
runLogicEngine(rawPRDText)
        │
        ▼
preProcessPRD(rawPRDText)
├── Normalize: \r\n → \n, tabs → 2 spaces, 3+ spaces → 2 spaces
├── Count: wordCount, charCount, lineCount
├── Estimate: readingTimeMinutes = ceil(wordCount / 200)
├── Validate: wordCount >= MIN_WORD_COUNT (50)
├── Validate: headingLines >= MIN_HEADING_COUNT (1)
├── Validate: charCount >= 200
├── Score PRD keywords: min 3 of 10 required
│   Keywords: require, must, should, shall, user, system,
│             feature, function, input, output
└── Returns: PRDPreProcessResult {
     isValidPRD, wordCount, charCount, lineCount,
     estimatedReadingTimeMinutes, languageWarnings[], cleanedText
   }
        │
        ▼
detectSections(cleanedText)
├── Tests 8 sections, each with 2 RegExp patterns
│   ├── problemStatement: /#{1,3}\s*(problem|background|context|overview)/i
│   ├── goal:             /#{1,3}\s*(goal|objective|purpose|aim)/i
│   ├── scope:            /#{1,3}\s*(scope|in scope|out of scope)/i
│   ├── acceptanceCriteria: /#{1,3}\s*(acceptance criteria|definition of done)/i
│   ├── assumptions:      /#{1,3}\s*(assumption|constraint|prerequisite)/i
│   ├── edgeCases:        /#{1,3}\s*(edge case|corner case|exception)/i
│   ├── dependencies:     /#{1,3}\s*(dependenc|integration|third.party)/i
│   └── errorHandling:    /#{1,3}\s*(error|failure|fallback|recovery)/i
├── completenessPercent = round((detected / 8) * 100)
└── Returns: SectionDetectResult {
     problemStatement, goal, scope, acceptanceCriteria,
     assumptions, edgeCases, dependencies, errorHandling,
     totalDetected, totalExpected, completenessPercent, missingSections[]
   }
        │
        ▼
detectAmbiguity(cleanedText)
├── Scans every line against 12 rule sets (40+ trigger words)
├── Rule severities:
│   CRITICAL: fast/quickly/real-time, scalable, TBD, etc/and so on
│   HIGH:     user-friendly/intuitive, seamless, optimized, soon/later
│   MEDIUM:   should/could/might, some/several/many, large/small
│   LOW:      good/great/robust, high quality
├── Deduplicates: same word on same line counted once
├── ambiguityDensity = round((findings.length / wordCount) * 100 * 100) / 100
└── Returns: AmbiguityDetectResult {
     findings[], totalFound, affectedLines[], ambiguityDensity
   }
        │
        ▼
detectMissingLogic(cleanedText)
├── 7 independent checks (each conditional):
│   1. Missing Error Handling       [critical] — always checked
│   2. Missing Edge Cases           [high]     — always checked
│   3. Missing Status Transitions   [high]     — only if status terms present
│   4. Missing Rollback Plan        [high]     — only if mutation verbs present
│   5. Missing Acceptance Criteria  [critical] — always checked
│   6. Missing Performance Bounds   [medium]   — only if API/network terms present
│   7. Missing Auth / Authz Spec    [high]     — only if user/access terms present
└── Returns: MissingLogicDetectResult { findings[], totalFound, ... }
        │
        ▼
detectUndefinedInputs(cleanedText)
├── 7 independent checks (all conditional):
│   1. Missing File Type Definition      [high]     — if upload terms present
│   2. Missing Validation Rules          [critical] — if form/input terms present
│   3. Missing Pagination Constraints    [medium]   — if pagination terms present
│   4. Missing Search/Filter Spec        [medium]   — if search terms present
│   5. Missing Date/Time Format          [high]     — if date/time terms present
│   6. Missing Notification Spec         [high]     — if notification terms present
│   7. Missing Rate Limiting Spec        [medium]   — if API endpoint terms present
└── Returns: UndefinedInputDetectResult { findings[], totalFound, ... }
        │
        ▼
calculateConfidence(sections, ambiguity, missingLogic, undefinedInputs)
├── structureScore    = round((completenessPercent / 100) * 40)          max 40
├── clarityDeduction  = min(30, round(ambiguityDensity * 30))
│   criticalDeduction = min(15, criticalAmbiguityCount * 3)
│   clarityScore      = max(0, 30 - clarityDeduction - criticalDeduction) max 30
├── For each issue: critical=-8, high=-5, medium=-3, low=-1
│   completenessScore = max(0, 30 - totalDeduction)                       max 30
├── totalScore = structureScore + clarityScore + completenessScore         max 100
└── Grade: A≥90, B≥75, C≥60, D≥40, F<40
        │
        ▼
buildEngineReport(preProcess, sections, ambiguity, missingLogic, undefinedInputs, confidence, processingTimeMs)
└── Returns: EngineReport (complete structured object passed to GPT-4o and stored in DB)
```

---

## GPT-4o Flow

```
analyzeWithAI(prdText, engineReport)
        │
        ▼
Build SYSTEM prompt
├── Role: "senior software engineering consultant"
├── Task: find gaps the logic engine CANNOT detect via pattern matching:
│   - Business logic contradictions
│   - Missing domain requirements (security, compliance, data privacy)
│   - Unclear user flows / missing journey steps
│   - Technical feasibility concerns
│   - Integration risks
│   - Missing non-functional requirements
│   - Semantic ambiguities requiring domain knowledge
├── Strict output rules:
│   - Return ONLY valid JSON, no markdown
│   - MAX 10 gaps (MAX_AI_GAPS)
│   - Only confidence >= 0.65 (MIN_CONFIDENCE)
│   - Every gap must have concrete recommendation
└── Exact JSON schema provided
        │
        ▼
Build USER prompt
├── Section 1: Full original PRD text
└── Section 2: Logic Engine Diagnostic Report
    ├── Readiness score + grade
    ├── Sections detected (N/8)
    ├── First 5 ambiguity findings with word + line + severity
    ├── All missing logic findings with category + severity
    └── All undefined input findings with category + severity
    └── Instruction: "Now identify ADDITIONAL semantic and domain-level gaps NOT already covered above"
        │
        ▼
openai.chat.completions.create({
  model: "gpt-4o",
  temperature: 0.2,         ← conservative, reduces hallucination
  max_tokens: 2000,
  response_format: { type: "json_object" }
})
        │
        ▼
rawContent = response.choices[0].message.content
        │
        ▼
clean = rawContent.replace(/```json|```/g, "").trim()
        │
        ▼
JSON.parse(clean)
On failure → throws Error("GPT-4o returned invalid JSON: ...")
        │
        ▼
Filter each gap:
├── gapType: must be truthy string
├── description: must be truthy string
├── severity: must be "critical"|"high"|"medium"|"low"
├── confidence: must be number >= MIN_CONFIDENCE (0.65)
└── recommendation: must be truthy string
        │
        ▼
.slice(0, MAX_AI_GAPS)     ← hard cap at 10
        │
        ▼
.map(g => ({ ...g, source: "ai" as const }))
        │
        ▼
Return: { gaps: AIGap[], aiSummary: string }
```

---

## Database Flow

```
POST /api/analyses — Write path:

db.insert(analysesTable).values({
  prdText: prdText.trim(),
  title: title.trim(),
  engineReport: JSON.stringify(engineReport),    ← stored as TEXT
  aiSummary: aiResult.aiSummary || null,
}).returning()                                   ← returns inserted row with id
        │
        ▼
if (mergedGaps.length > 0):
  db.insert(gapsTable).values(
    mergedGaps.map(g => ({
      analysisId: analysis.id,
      gapType: g.gapType,
      description: g.description,
      severity: g.severity,
      confidence: g.confidence,
      source: g.source,
      recommendation: g.recommendation,
    }))
  ).returning()

GET /api/analyses/:id — Read path:

db.select().from(analysesTable).where(eq(id, params.id))
        │
        ▼
db.select().from(gapsTable)
  .where(eq(analysisId, analysis.id))
  .orderBy(CASE severity WHEN critical THEN 1 ... END)
        │
        ▼
For each gap:
  db.select(isHelpful).from(feedbackTable).where(eq(gapId, gap.id))
  → helpfulCount  = rows.filter(f => f.isHelpful === 1).length
  → notHelpfulCount = rows.filter(f => f.isHelpful === 0).length

DELETE /api/analyses/:id — Cascade path:

db.delete(analysesTable).where(eq(id, params.id))
→ ON DELETE CASCADE propagates to gaps → feedback automatically
```

---

## Gap Merger Flow

```
mergeGaps(engineReport, aiGaps[])
        │
        ▼
engineReportToGaps(engineReport)
├── For each missingSections[]:
│   └── { gapType: "Missing Section", severity: critical|high, confidence: 0.99 }
│       (Acceptance Criteria + Error Handling → critical; others → high)
├── For each ambiguity finding (critical or high severity only):
│   └── Deduplicated by suggestion text (same suggestion = same rule = one gap)
│       { gapType: "Ambiguous Requirement", confidence: severity-mapped }
├── For each missingLogic finding:
│   └── { gapType: finding.category, confidence: severity-mapped }
└── For each undefinedInputs finding:
    └── { gapType: finding.category, confidence: severity-mapped }

Severity → confidence mapping:
  critical → 0.95 · high → 0.85 · medium → 0.70 · low → 0.60
        │
        ▼
For each AI gap — deduplication check:
  aiWords = new Set(aiGap.description.toLowerCase().split(/\s+/))
  For each existing logic gap:
    existingWords = existing.description.toLowerCase().split(/\s+/)
    overlap = words in both sets where word.length > 4
    overlapRatio = overlap / min(aiWords.size, existingWords.length)
    if overlapRatio > 0.5 → isDuplicate = true → DROP this AI gap
        │
        ▼
allGaps = [...logicEngineGaps, ...nonDuplicateAIGaps]
        │
        ▼
allGaps.sort((a, b) =>
  (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  || (b.confidence - a.confidence)
)
Where SEVERITY_ORDER: { critical: 0, high: 1, medium: 2, low: 3 }
        │
        ▼
return allGaps.slice(0, MAX_TOTAL_GAPS)   ← hard cap at 15
```

---

## Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Monorepo structure | pnpm workspaces | Shared TypeScript types between frontend and backend without duplication or version drift |
| ORM | Drizzle ORM v0.45 | Type-safe SQL, lightweight runtime, excellent PostgreSQL support, schema-first approach |
| Frontend state management | React Query v5 | Server state management with built-in caching, loading/error states, and optimistic updates |
| UI component library | shadcn/ui (55 components) | Accessible Radix UI primitives with full Tailwind styling control — no opinionated design lock-in |
| Client-side routing | Wouter v3 | Lightweight React Router alternative — 1.5KB vs 14KB, sufficient for 4-page SPA |
| AI model | GPT-4o | Best reasoning quality for semantic gap detection; `response_format: json_object` ensures structured output |
| AI temperature | 0.2 | Conservative setting reduces hallucination while retaining contextual reasoning |
| Database | PostgreSQL (Replit managed) | Relational integrity (FK cascades), connection pooling, JSON storage for engine reports, production-grade reliability |
| Logging | pino | Structured JSON logging with minimal overhead; `req.log` in routes, singleton `logger` for services |
| API contract | OpenAPI + Orval codegen | Single source of truth for API shape; generated React Query hooks and Zod schemas stay in sync automatically |
| Validation | Zod v3 (used as zod/v4) | Runtime type safety at API boundaries; schemas shared between frontend and backend via `@workspace/api-zod` |
| Build tool | esbuild (API) + Vite v7 (frontend) | esbuild for fast CJS bundle of the Express server; Vite for HMR and optimised frontend builds |
