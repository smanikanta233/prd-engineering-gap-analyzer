# Database Design — PRD Engineering Gap Analyzer

## Platform

PostgreSQL managed by Replit. Connection via `pg.Pool` with Drizzle ORM for type-safe queries. Schema defined in `lib/db/src/schema/analyses.ts`.

---

## Entity Relationship

```
analyses (1) ──────────< gaps (many)
gaps (1)     ──────────< feedback (many)
```

---

## Table: analyses

Stores each PRD submission and its full logic engine diagnostic report.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Auto-incrementing integer |
| title | TEXT | NOT NULL, DEFAULT 'Untitled PRD' | User-provided PRD title (min 3 chars at API layer) |
| prd_text | TEXT | NOT NULL | Full PRD content submitted by user |
| engine_report | TEXT | NULL | JSON-serialised EngineReport from the Logic Engine |
| ai_summary | TEXT | NULL | 2–3 sentence GPT-4o assessment (null if AI unavailable) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | UTC timestamp of submission |

**Notes:**
- `engine_report` is stored as TEXT containing a JSON string. The application parses it back to an object on read (`JSON.parse`) and serialises on write (`JSON.stringify`)
- `ai_summary` is NULL when OpenAI was unavailable at analysis time — the frontend conditionally hides the AI Summary card when this field is null
- `prd_text` is stored in full to enable the original PRD view on the analysis detail page
- Analyses are immutable after creation — there is no `updated_at` column

---

## Table: gaps

Stores each individual gap found during analysis. Each gap belongs to exactly one analysis.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Auto-incrementing integer |
| analysis_id | INTEGER | NOT NULL, FK → analyses.id ON DELETE CASCADE | Parent analysis |
| gap_type | TEXT | NOT NULL | Category name (e.g. "Missing Section", "Security Gap") |
| description | TEXT | NOT NULL | Human-readable description of the gap |
| severity | TEXT | NOT NULL | One of: critical, high, medium, low |
| confidence | REAL | NOT NULL, DEFAULT 0 | 0.0–1.0 confidence score |
| source | TEXT | NOT NULL, DEFAULT 'logic-engine' | One of: logic-engine, ai |
| recommendation | TEXT | NULL | Actionable fix recommendation |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | UTC timestamp |

**Notes:**
- `severity` is TEXT (not a PostgreSQL enum) for flexibility — validated at application layer via Zod
- `source` distinguishes logic engine findings from GPT-4o findings for transparency and analytics
- `recommendation` is nullable for schema compatibility — in practice all gaps have recommendations
- Gaps cascade-delete when their parent analysis is deleted (ON DELETE CASCADE on the FK)

**Severity definitions:**
- `critical` — blocks engineering handoff, must be resolved before development starts
- `high` — significant gap, should be resolved before development starts
- `medium` — worth addressing but will not block engineering
- `low` — nice to have, minor improvement

**Source values:**
- `logic-engine` — detected deterministically by the rule-based logic engine
- `ai` — detected semantically by GPT-4o, not already covered by logic engine

---

## Table: feedback

Stores user feedback (thumbs up/down) on individual gaps.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Auto-incrementing integer |
| gap_id | INTEGER | NOT NULL, FK → gaps.id ON DELETE CASCADE | The gap being rated |
| is_helpful | INTEGER | NOT NULL | 1 = thumbs up, 0 = thumbs down |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | UTC timestamp |

**Notes:**
- `is_helpful` is stored as INTEGER (1/0) rather than BOOLEAN for cross-version PostgreSQL client compatibility
- Multiple feedback records per gap are allowed — the API sums them into `helpfulCount` and `notHelpfulCount` on read
- Feedback is anonymous — no `user_id` column. Designed for a single-user portfolio tool
- Feedback records cascade-delete when their parent gap is deleted

---

## Key Queries

**Get analysis with all gaps and feedback counts (as implemented in the route):**
```sql
-- Step 1: get analysis
SELECT * FROM analyses WHERE id = $1;

-- Step 2: get gaps ordered by severity
SELECT * FROM gaps
WHERE analysis_id = $1
ORDER BY CASE severity
  WHEN 'critical' THEN 1
  WHEN 'high'     THEN 2
  WHEN 'medium'   THEN 3
  WHEN 'low'      THEN 4
END;

-- Step 3: for each gap, get feedback
SELECT is_helpful FROM feedback WHERE gap_id = $1;
```

**Get summary statistics:**
```sql
SELECT
  COUNT(DISTINCT analyses.id)::int AS total_analyses,
  COUNT(gaps.id)::int              AS total_gaps,
  COALESCE(AVG(gaps.confidence), 0) AS avg_confidence
FROM analyses
LEFT JOIN gaps ON gaps.analysis_id = analyses.id;
```

**Get severity distribution:**
```sql
SELECT severity, COUNT(*)::int AS count
FROM gaps
GROUP BY severity
ORDER BY count DESC;
```

**Get gap type breakdown with most common severity:**
```sql
SELECT
  gap_type,
  COUNT(*)::int AS count,
  AVG(confidence) AS avg_confidence
FROM gaps
GROUP BY gap_type
ORDER BY count DESC;
```

---

## Design Decisions

| Decision | Reason |
|---|---|
| PostgreSQL over SQLite | Replit provides managed PostgreSQL with connection pooling, backups, and failover. SQLite is inappropriate for a deployed web app with concurrent requests |
| TEXT for engine_report (not JSONB) | Simplicity — the full report is always read as a whole, never queried partially. JSONB would be worth adding if partial queries on nested fields (e.g. confidence score) were needed |
| TEXT severity (not enum) | Avoids PostgreSQL enum migration complexity. Zod validation at the application layer enforces the allowed values |
| INTEGER for is_helpful (not BOOLEAN) | Compatibility across pg client versions; avoids type coercion surprises |
| No user authentication table | Out of scope for this version — single-user tool for portfolio/demo purposes |
| No soft deletes | Analyses are hard-deleted. For a portfolio tool this simplifies schema and queries |
| Drizzle ORM over raw SQL | Type-safe queries that match TypeScript interfaces — prevents runtime type mismatches between DB rows and API response shapes |
| CASCADE DELETE on all FKs | Simplifies delete logic — deleting an analysis removes all its gaps and all their feedback automatically, no multi-step cleanup required |
