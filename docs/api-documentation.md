# API Documentation — PRD Engineering Gap Analyzer

Base URL: `https://prd-analyzer.replit.app/api`  
All requests and responses use `Content-Type: application/json`.

---

## Health Endpoints

### GET /api/healthz

Returns server health status. Used by Replit deployment health checks.

**Response 200:**
```json
{
  "status": "OK",
  "message": "PRD Gap Analyzer backend is running!",
  "timestamp": "2026-06-17T14:30:00.000Z"
}
```

---

## Analysis Endpoints

### POST /api/analyses

Runs the full analysis pipeline: Logic Engine → GPT-4o → Gap Merger → Store.

**Request body:**
```json
{
  "title": "User Authentication Module v2.0",
  "prdText": "## Background\n..."
}
```

**Validation:**
- `title`: required, string, minimum 3 characters
- `prdText`: required, string, minimum 50 characters

**Response 201:**
```json
{
  "id": 1,
  "title": "User Authentication Module v2.0",
  "prdText": "## Background\n...",
  "createdAt": "2026-06-17T14:30:00.000Z",
  "engineReport": {
    "confidence": {
      "structureScore": 15,
      "clarityScore": 0,
      "completenessScore": 0,
      "totalScore": 15,
      "grade": "F",
      "interpretation": "PRD is not ready for engineering."
    },
    "sections": {
      "problemStatement": true,
      "goal": true,
      "scope": true,
      "acceptanceCriteria": false,
      "assumptions": false,
      "edgeCases": false,
      "dependencies": false,
      "errorHandling": false,
      "totalDetected": 3,
      "totalExpected": 8,
      "completenessPercent": 38,
      "missingSections": ["Acceptance Criteria", "Assumptions", "Edge Cases", "Dependencies", "Error Handling"]
    },
    "summary": {
      "totalIssuesFound": 16,
      "criticalCount": 6,
      "highCount": 7,
      "mediumCount": 3,
      "lowCount": 0,
      "topIssues": ["..."],
      "readinessLabel": "Not Ready"
    },
    "processingTimeMs": 11
  },
  "aiSummary": "The PRD lacks critical security requirements...",
  "gaps": [
    {
      "id": 1,
      "analysisId": 1,
      "gapType": "Missing Section",
      "description": "Required PRD section \"Acceptance Criteria\" is missing.",
      "severity": "critical",
      "confidence": 0.99,
      "recommendation": "Add an Acceptance Criteria section before engineering handoff.",
      "source": "logic-engine",
      "createdAt": "2026-06-17T14:30:00.000Z",
      "helpfulCount": 0,
      "notHelpfulCount": 0
    }
  ]
}
```

**Response 400** (validation failure):
```json
{ "error": "Validation error message from Zod" }
```

**Response 500** (server error):
```json
{ "error": "Internal server error message" }
```

---

### GET /api/analyses

Returns all analyses ordered by most recent, with gap count summaries.

**Response 200:**
```json
[
  {
    "id": 1,
    "title": "User Authentication Module v2.0",
    "prdText": "## Background\n...",
    "engineReport": "...",
    "aiSummary": "...",
    "createdAt": "2026-06-17T14:30:00.000Z",
    "gapCount": 15,
    "criticalCount": 9,
    "highCount": 6,
    "mediumCount": 0,
    "lowCount": 0
  }
]
```

---

### GET /api/analyses/summary

Returns aggregate statistics for the admin dashboard and home page metrics sidebar.

**Response 200:**
```json
{
  "totalAnalyses": 3,
  "totalGaps": 38,
  "avgGapsPerAnalysis": 12.7,
  "avgConfidence": 0.87,
  "totalFeedback": 5,
  "gapTypeBreakdown": [
    {
      "gapType": "Missing Section",
      "count": 8,
      "avgConfidence": 0.99,
      "mostCommonSeverity": "critical"
    }
  ],
  "severityBreakdown": [
    { "severity": "critical", "count": 14 },
    { "severity": "high", "count": 18 },
    { "severity": "medium", "count": 6 },
    { "severity": "low", "count": 0 }
  ],
  "feedbackSummary": [
    {
      "gapType": "Missing Section",
      "helpfulCount": 4,
      "notHelpfulCount": 1,
      "helpfulnessRate": 0.8
    }
  ]
}
```

---

### GET /api/analyses/:id

Returns a single analysis with all gaps sorted by severity, each with feedback counts.

**Path parameter:** `id` — integer, analysis ID

**Response 200:**
```json
{
  "id": 1,
  "title": "User Authentication Module v2.0",
  "prdText": "## Background\n...",
  "engineReport": { "confidence": {...}, "sections": {...}, "summary": {...}, "processingTimeMs": 11 },
  "aiSummary": "The PRD lacks critical security requirements...",
  "createdAt": "2026-06-17T14:30:00.000Z",
  "gaps": [
    {
      "id": 1,
      "analysisId": 1,
      "gapType": "Missing Section",
      "description": "Required PRD section \"Acceptance Criteria\" is missing.",
      "severity": "critical",
      "confidence": 0.99,
      "source": "logic-engine",
      "recommendation": "Add an Acceptance Criteria section before engineering handoff.",
      "createdAt": "2026-06-17T14:30:00.000Z",
      "helpfulCount": 2,
      "notHelpfulCount": 0
    }
  ]
}
```

Gaps are ordered: critical → high → medium → low. Within each severity, ordered by confidence descending.

**Response 400** (invalid id):
```json
{ "error": "Validation error message" }
```

**Response 404:**
```json
{ "error": "Analysis not found" }
```

---

### DELETE /api/analyses/:id

Deletes an analysis and all its associated gaps and feedback (cascade).

**Path parameter:** `id` — integer, analysis ID

**Response 204:** No content.

**Response 404:**
```json
{ "error": "Analysis not found" }
```

---

## Feedback Endpoint

### POST /api/gaps/:id/feedback

Submits thumbs up or thumbs down feedback on a specific gap. Multiple submissions per gap are allowed.

**Path parameter:** `id` — integer, gap ID

**Request body:**
```json
{ "isHelpful": true }
```

- `isHelpful`: required, boolean

**Response 201:**
```json
{
  "id": 7,
  "gapId": 42,
  "isHelpful": true,
  "createdAt": "2026-06-17T16:19:46.000Z"
}
```

**Response 404:**
```json
{ "error": "Gap not found" }
```

**Response 400** (invalid body):
```json
{ "error": "Validation error message" }
```

---

## Test Endpoints

### GET /api/engine-test

Runs only the Logic Engine (no GPT-4o, no DB writes) on a built-in weak sample PRD. Use to verify the logic engine is working without consuming OpenAI tokens.

**Response 200:** Full `EngineReport` object.

---

### GET /api/engine-test-full

Runs the complete pipeline (Logic Engine + GPT-4o + Gap Merger) on the same built-in weak sample PRD. No DB writes. Use to verify the full pipeline end-to-end.

**Response 200:**
```json
{
  "engineReport": { "confidence": {...}, "sections": {...}, "summary": {...}, "processingTimeMs": 11 },
  "aiSummary": "...",
  "gaps": [...],
  "totalGaps": 15,
  "criticalCount": 9,
  "highCount": 6,
  "mediumCount": 0,
  "lowCount": 0,
  "aiGapCount": 1,
  "logicEngineGapCount": 14
}
```

---

## Error Codes

| HTTP Status | Meaning |
|---|---|
| 200 | Success |
| 201 | Created (new analysis or feedback record) |
| 204 | Deleted (no content returned) |
| 400 | Validation error — check request body or path params |
| 404 | Resource not found |
| 500 | Server error — check server logs |
