# System Architecture — PRD Engineering Gap Analyzer

## Overview

The system is built as a **pnpm monorepo** with two deployable artifacts (frontend and backend) and three shared libraries. Everything runs on Replit with a managed PostgreSQL database.

```
prd-engineering-gap-analyzer/
├── artifacts/
│   ├── api-server/          # Express 5 backend (TypeScript)
│   └── prd-analyzer/        # React 19 + Vite frontend (TypeScript)
├── lib/
│   ├── db/                  # Drizzle ORM schema + PostgreSQL client
│   ├── api-zod/             # Shared Zod validation schemas
│   └── api-client-react/    # Generated React Query hooks
└── docs/                    # This documentation
```

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                          │
│  React 19 + Vite + TypeScript + TailwindCSS + shadcn/ui     │
│  Pages: Home / History / Analysis Detail / Admin            │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP/JSON (React Query)
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    EXPRESS 5 BACKEND                         │
│  TypeScript + Drizzle ORM + pino logger                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              LOGIC ENGINE (deterministic)            │   │
│  │  preProcessor → sectionDetector → ambiguityDetector  │   │
│  │  → missingLogicDetector → undefinedInputDetector    │   │
│  │  → confidenceCalculator → engineReport              │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │              OPENAI SERVICE (semantic)               │   │
│  │  Sends EngineReport + PRD text to GPT-4o            │   │
│  │  Returns: AIGap[] + aiSummary                       │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│  ┌──────────────────────▼──────────────────────────────┐   │
│  │                   GAP MERGER                         │   │
│  │  Deduplicates + sorts + caps at 15 gaps             │   │
│  └──────────────────────┬──────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │ Drizzle ORM
                          │
┌─────────────────────────▼───────────────────────────────────┐
│              POSTGRESQL (Replit managed)                     │
│  Tables: analyses · gaps · feedback                         │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   OPENAI API (external)                      │
│  Model: gpt-4o · temperature: 0.2 · max_tokens: 2000       │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend Flow

```
User opens app (/)
        │
        ▼
Home page loads
├── Fetches GET /api/analyses/summary → renders System Metrics sidebar
├── Fetches GET /api/analyses → renders Recent Analyses (last 5)
└── Renders PRD form (Title + Content textarea)

User fills form + clicks "Run Gap Analysis"
        │
        ▼
Multi-step loading UI appears
├── Step 1: "Running logic engine..." (t=0ms)
├── Step 2: "Detecting ambiguities..." (t=900ms)
├── Step 3: "Sending to GPT-4o..." (t=2000ms)
└── Step 4: "Merging findings..." (on response)

POST /api/analyses called via React Query mutation
        │
        ▼
On success → navigate to /analyses/:id
        │
        ▼
Analysis Detail page
├── Renders Readiness Score Card (from engineReport.confidence)
├── Renders AI Summary Card (from aiSummary)
├── Renders Section Coverage Panel (from engineReport.sections)
├── Renders gap list (filter + sort + feedback + export)
└── Renders original PRD text (left panel)
```

---

## Backend Flow

```
POST /api/analyses
        │
        ▼
1. Input validation (Zod)
   ├── title: string, min 3 chars
   └── prdText: string, min 50 chars
        │
        ▼
2. runLogicEngine(prdText) — ~3–15ms
        │
        ▼
3. analyzeWithAI(prdText, engineReport) — ~3–8 seconds
   └── On failure: graceful fallback to empty AI results
        │
        ▼
4. mergeGaps(engineReport, aiGaps)
        │
        ▼
5. db.insert(analyses) → get analysisId
        │
        ▼
6. db.insert(gaps) — bulk insert all merged gaps
        │
        ▼
7. Return HTTP 201 with full result object
```

---

## Logic Engine Flow

```
runLogicEngine(rawPRDText)
        │
        ▼
preProcessPRD(rawPRDText)
├── Clean whitespace and normalize line endings
├── Count words, chars, lines
├── Check MIN_WORD_COUNT (50)
├── Check heading count
├── Check PRD keyword presence (min 3 of 10 keywords)
└── Returns: PRDPreProcessResult { isValidPRD, cleanedText, wordCount, ... }
        │
        ▼
Run 4 detectors on cleanedText (sequential)
│
├── detectSections(text)
│   └── Pattern match 8 sections via RegExp arrays
│       Returns: SectionDetectResult { problemStatement, goal, ..., missingSections[] }
│
├── detectAmbiguity(text)
│   └── Scan every line for 12 ambiguity rule sets (40+ trigger words)
│       Returns: AmbiguityDetectResult { findings[], ambiguityDensity }
│
├── detectMissingLogic(text)
│   └── 7 conditional checks (error handling, edge cases, rollback, auth, etc.)
│       Returns: MissingLogicDetectResult { findings[], hasErrorHandling, ... }
│
└── detectUndefinedInputs(text)
    └── 7 pattern checks (file upload, validation, pagination, dates, etc.)
        Returns: UndefinedInputDetectResult { findings[], missingFileTypeDefinitions, ... }
        │
        ▼
calculateConfidence(sections, ambiguity, missingLogic, undefinedInputs)
└── Returns: ConfidenceBreakdown { structureScore, clarityScore, completenessScore, totalScore, grade }
        │
        ▼
buildEngineReport(all results, processingTimeMs)
└── Returns: EngineReport (complete structured object)
```

---

## GPT-4o Flow

```
analyzeWithAI(prdText, engineReport)
        │
        ▼
Build system prompt
└── Defines role, output format, max gaps (10), min confidence (0.65)
    Instructs: "DO NOT repeat logic engine findings"
        │
        ▼
Build user prompt
├── Section 1: Original PRD text
└── Section 2: Logic engine findings summary (so GPT-4o knows what's already caught)
        │
        ▼
openai.chat.completions.create()
├── model: "gpt-4o"
├── temperature: 0.2
└── max_tokens: 2000
        │
        ▼
Strip markdown fences from response
        │
        ▼
JSON.parse()
        │
        ▼
Validate each gap:
├── gapType: string present
├── description: string present
├── severity: one of critical|high|medium|low
├── confidence: number >= 0.65
└── recommendation: string present
        │
        ▼
Slice to MAX_AI_GAPS (10)
        │
        ▼
Return: { gaps: AIGap[], aiSummary: string }
```

---

## Database Flow

```
On POST /api/analyses success:

INSERT INTO analyses (title, prd_text, engine_report, ai_summary)
VALUES ($1, $2, $3, $4)
RETURNING id
        │
        ▼
For each gap in mergedGaps[]:
INSERT INTO gaps
  (analysis_id, gap_type, description, severity, confidence, source, recommendation)
VALUES (...)
        │
        ▼
On POST /api/gaps/:id/feedback:
INSERT INTO feedback (gap_id, is_helpful)
VALUES ($1, $2)

On DELETE /api/analyses/:id:
DELETE FROM analyses WHERE id = $1
(gaps and feedback cascade automatically via FK ON DELETE CASCADE)
```

---

## Gap Merger Flow

```
mergeGaps(engineReport, aiGaps[])
        │
        ▼
engineReportToGaps(engineReport)
├── missingSections → 1 gap each (confidence: 0.99)
├── ambiguity findings (critical + high only, deduplicated by suggestion)
├── missingLogic findings → 1 gap each
└── undefinedInputs findings → 1 gap each
        │
        ▼
For each AI gap:
└── isDuplicate check against all logic engine gaps
    └── If word overlap ratio > 0.5 → DROP the AI gap
        │
        ▼
Combine: [...logicGaps, ...nonDuplicateAIGaps]
        │
        ▼
Sort:
├── Primary: severity (critical=0, high=1, medium=2, low=3)
└── Secondary: confidence descending
        │
        ▼
Slice to MAX_TOTAL_GAPS (15)
        │
        ▼
Return: UnifiedGap[]
```

---

## Technology Decisions

| Decision | Choice | Reason |
|---|---|---|
| Monorepo | pnpm workspaces | Shared types between frontend and backend without duplication |
| ORM | Drizzle ORM | Type-safe SQL, lightweight, works well with PostgreSQL |
| Frontend state | React Query | Server state management with caching, loading states, mutations |
| UI components | shadcn/ui | Accessible, unstyled primitives — full design control |
| AI model | GPT-4o | Best balance of reasoning quality and response speed for PRD analysis |
| Database | PostgreSQL | Relational integrity between analyses, gaps, and feedback; JSON column for engine report |
| Logging | pino | Structured JSON logging, low overhead, Replit-compatible |
