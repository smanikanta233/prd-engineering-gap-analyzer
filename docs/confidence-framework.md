# Confidence Framework — PRD Engineering Gap Analyzer

## Philosophy

The confidence score in this system is **fully deterministic**. It does not use AI, machine learning, or any probabilistic model. The same PRD text will always produce the same score. This is intentional.

When a PM asks "why did my PRD score 42/100?", the answer must be explainable in plain English, not "the model decided so." Deterministic scoring is auditable, improvable, and trustworthy.

---

## Formula

```
totalScore = structureScore + clarityScore + completenessScore

Maximum possible: 40 + 30 + 30 = 100
```

---

## Scoring Factors

### 1. Structure Score (0–40 points)

Measures how many of the 8 required PRD sections are present.

```
structureScore = Math.round((sections.completenessPercent / 100) * 40)
```

The 8 required sections and their detection patterns:

| Section | Required? | Detection Method |
|---|---|---|
| Problem Statement | Yes | Matches "## Background", "## Context", "problem statement" |
| Goals / Objectives | Yes | Matches "## Goals", "## Objectives", "success criteria" |
| Scope | Yes | Matches "## Scope", "in scope", "out of scope" |
| Acceptance Criteria | Yes | Matches "## Acceptance Criteria", "definition of done", "done when" |
| Assumptions | Yes | Matches "## Assumptions", "we assume", "prerequisites" |
| Edge Cases | Yes | Matches "## Edge Cases", "corner case", "boundary condition" |
| Dependencies | Yes | Matches "## Dependencies", "depends on", "integration with" |
| Error Handling | Yes | Matches "## Error Handling", "failure scenario", "fallback" |

**Examples:**
- 8/8 sections → completenessPercent = 100% → structureScore = 40
- 4/8 sections → completenessPercent = 50% → structureScore = 20
- 0/8 sections → completenessPercent = 0% → structureScore = 0

---

### 2. Clarity Score (0–30 points)

Measures how free the PRD is from vague, unmeasurable language.

```
clarityDeduction = Math.min(30, Math.round(ambiguity.ambiguityDensity * 30))
criticalDeduction = Math.min(15, criticalAmbiguityCount * 3)
clarityScore = Math.max(0, 30 - clarityDeduction - criticalDeduction)
```

Where `ambiguityDensity = findings per 100 words`.

**Ambiguity severity levels:**

| Severity | Words/Phrases | Points deducted |
|---|---|---|
| Critical | fast, scalable, TBD, etc., to be determined | 3 pts each (max 15) |
| High | user-friendly, seamless, optimized, later | Via density |
| Medium | should, could, some, several, many | Via density |
| Low | good, robust, high quality | Via density |

**Examples:**
- 0 ambiguities → clarityScore = 30
- density = 0.5 (1 ambiguity per 200 words), 2 critical → clarityScore = 30 − 15 − 6 = 9
- density ≥ 1.0 or many criticals → clarityScore = 0

---

### 3. Completeness Score (0–30 points)

Measures how few missing logic and undefined input issues exist.

```
completenessScore = Math.max(0, 30 - totalDeduction)
```

Where each issue deducts based on its severity:

| Severity | Points deducted per issue |
|---|---|
| Critical | 8 points |
| High | 5 points |
| Medium | 3 points |
| Low | 1 point |

Issues come from two detectors:
- **Missing Logic Detector** (7 checks): error handling, edge cases, status transitions, rollback plan, acceptance criteria, performance boundaries, auth spec
- **Undefined Input Detector** (7 checks): file type constraints, validation rules, pagination spec, search spec, date format, notification spec, rate limiting spec

**Examples:**
- 0 issues → completenessScore = 30
- 1 critical + 1 high → 30 − 8 − 5 = 17
- 4 critical issues → 30 − 32 = 0 (floor at 0)

---

## Grade Scale

| Score | Grade | Readiness Label | Interpretation |
|---|---|---|---|
| 90–100 | A | Ready | Excellent PRD. Ready for engineering handoff with minor polish. |
| 75–89 | B | Almost Ready | Good PRD. A few gaps to address before engineering begins. |
| 60–74 | C | Needs Work | Acceptable PRD but significant gaps exist. Review recommended. |
| 40–59 | D | Needs Work | Weak PRD. Multiple critical gaps detected. Substantial revision needed. |
| 0–39 | F | Not Ready | PRD is not ready for engineering. Critical sections and definitions are missing. |

---

## Example Calculations

### Example 1: Weak Authentication PRD (from /api/engine-test)

```
Input PRD: "The system should be fast, scalable, user-friendly..."

Section detector:
  Detected: problemStatement=true, goal=true, scope=true (3/8)
  completenessPercent = 37.5% → rounded to 38%
  structureScore = Math.round(0.38 * 40) = 15

Ambiguity detector:
  findings: fast(critical), scalable(critical), user-friendly(high), etc(critical), should(medium×2), later(high)
  totalFound: 8
  ambiguityDensity: 8/63 words * 100 = 12.70
  clarityDeduction = Math.min(30, round(12.70 * 30)) = 30
  criticalDeduction = Math.min(15, 3 * 3) = 9
  clarityScore = Math.max(0, 30 - 30 - 9) = 0

Missing logic + undefined inputs:
  4 missing logic findings (2 critical, 2 high)
  4 undefined input findings (1 critical, 3 high)
  totalDeduction = (3 * 8) + (5 * 5) = 24 + 25 = 49
  completenessScore = Math.max(0, 30 - 49) = 0

TOTAL = 15 + 0 + 0 = 15 → Grade F → "Not Ready"
```

### Example 2: Refund PRD (well-written)

```
Assumptions (approximate):
  All 8 sections detected → completenessPercent = 100%
  structureScore = 40

  0 critical ambiguities, density ~0.1
  clarityDeduction = round(0.1 * 30) = 3
  clarityScore = 30 - 3 - 0 = 27

  1 medium missing logic finding (performance boundaries)
  completenessDeduction = 3
  completenessScore = 30 - 3 = 27

TOTAL = 40 + 27 + 27 = 94 → Grade A → "Ready"
```

### Example 3: Half-Complete PRD (4 of 8 sections)

```
4/8 sections → structureScore = 20
0 ambiguities → clarityScore = 30
0 other issues → completenessScore = 30

TOTAL = 20 + 30 + 30 = 80 → Grade B → "Almost Ready"
```

---

## Why Deterministic Scoring (Not AI Scoring)

Three reasons:

**1. Explainability**  
When a PM asks why their PRD scored 42, the answer is: "You have 4 of 8 sections (structure: 20/40), moderate ambiguity (clarity: 10/30), and 2 critical missing logic issues (completeness: 12/30)." This is actionable. "The AI gave it a 42" is not.

**2. Reproducibility**  
Deterministic scoring means the same PRD always gets the same score. PMs can iterate on their document and see the score change in a predictable, trustworthy way. AI scores can fluctuate between runs.

**3. Speed and Cost**  
The confidence score is computed in ~3ms with zero API calls. Running it on every analysis costs nothing and adds no latency. Using GPT-4o for scoring would add 3–8 seconds and API cost per analysis.

The AI layer (GPT-4o) is reserved for what only AI can do: semantic gap detection. Scoring is left to deterministic logic where it belongs.
