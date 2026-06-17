import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, analysesTable, gapsTable, feedbackTable } from "@workspace/db";
import {
  CreateAnalysisBody,
  GetAnalysisParams,
  DeleteAnalysisParams,
  SubmitGapFeedbackParams,
  SubmitGapFeedbackBody,
} from "@workspace/api-zod";
import { logger } from "../lib/logger.js";
import { runLogicEngine } from "../services/logic-engine/index.js";
import { analyzeWithAI } from "../services/openai/prdAnalyzer.js";
import { mergeGaps } from "../services/gapMerger.js";

const router: IRouter = Router();

// ── Sample PRD for test endpoints ───────────────────────────────────────────
const SAMPLE_PRD = `## Background
We need to build a user authentication system for our platform.

## Goals
The system should be fast, user-friendly and scalable.

## Requirements
- Users can login with email and password
- The system should send notifications
- Upload profile pictures
- Search for other users
- Admin can manage users etc.

## Out of Scope
- Social login (maybe later)
`;

// ── GET /api/engine-test ─────────────────────────────────────────────────────
// Tests the deterministic logic engine only — no DB writes, no OpenAI.
router.get("/engine-test", async (_req, res): Promise<void> => {
  const report = await runLogicEngine(SAMPLE_PRD);
  res.json(report);
});

// ── GET /api/engine-test-full ────────────────────────────────────────────────
// Runs the COMPLETE pipeline (logic engine + AI + merge) on the sample PRD.
// Verifies end-to-end flow without using the frontend. No DB writes.
router.get("/engine-test-full", async (_req, res): Promise<void> => {
  const engineReport = await runLogicEngine(SAMPLE_PRD);

  let aiResult = { gaps: [] as Awaited<ReturnType<typeof analyzeWithAI>>["gaps"], aiSummary: "" };
  try {
    aiResult = await analyzeWithAI(SAMPLE_PRD, engineReport);
  } catch (err) {
    logger.warn({ err }, "OpenAI unavailable in engine-test-full — returning logic engine only");
  }

  const mergedGaps = mergeGaps(engineReport, aiResult.gaps);

  res.json({
    engineReport: {
      confidence: engineReport.confidence,
      sections: engineReport.sections,
      summary: engineReport.summary,
      processingTimeMs: engineReport.processingTimeMs,
    },
    aiSummary: aiResult.aiSummary,
    gaps: mergedGaps,
    totalGaps: mergedGaps.length,
    criticalCount: mergedGaps.filter((g) => g.severity === "critical").length,
    highCount: mergedGaps.filter((g) => g.severity === "high").length,
    mediumCount: mergedGaps.filter((g) => g.severity === "medium").length,
    lowCount: mergedGaps.filter((g) => g.severity === "low").length,
    aiGapCount: mergedGaps.filter((g) => g.source === "ai").length,
    logicEngineGapCount: mergedGaps.filter((g) => g.source === "logic-engine").length,
  });
});

// ── GET /api/analyses/summary ────────────────────────────────────────────────
router.get("/analyses/summary", async (_req, res): Promise<void> => {
  const [totals] = await db
    .select({
      totalAnalyses: sql<number>`count(distinct ${analysesTable.id})::int`,
      totalGaps: sql<number>`count(${gapsTable.id})::int`,
      avgConfidence: sql<number>`coalesce(avg(${gapsTable.confidence}), 0)`,
    })
    .from(analysesTable)
    .leftJoin(gapsTable, eq(gapsTable.analysisId, analysesTable.id));

  const totalFeedbackRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(feedbackTable);
  const totalFeedback = totalFeedbackRows[0]?.count ?? 0;

  const gapTypeRaw = await db
    .select({
      gapType: gapsTable.gapType,
      count: sql<number>`count(*)::int`,
      avgConfidence: sql<number>`avg(${gapsTable.confidence})`,
    })
    .from(gapsTable)
    .groupBy(gapsTable.gapType)
    .orderBy(sql`count(*) desc`);

  const gapTypeBreakdown = await Promise.all(
    gapTypeRaw.map(async (row) => {
      const severityRows = await db
        .select({
          severity: gapsTable.severity,
          count: sql<number>`count(*)::int`,
        })
        .from(gapsTable)
        .where(eq(gapsTable.gapType, row.gapType))
        .groupBy(gapsTable.severity)
        .orderBy(sql`count(*) desc`)
        .limit(1);

      return {
        gapType: row.gapType,
        count: row.count,
        avgConfidence: Math.round(Number(row.avgConfidence) * 100) / 100,
        mostCommonSeverity: severityRows[0]?.severity ?? "low",
      };
    })
  );

  const severityBreakdown = await db
    .select({
      severity: gapsTable.severity,
      count: sql<number>`count(*)::int`,
    })
    .from(gapsTable)
    .groupBy(gapsTable.severity)
    .orderBy(sql`count(*) desc`);

  const feedbackRaw = await db
    .select({
      gapType: gapsTable.gapType,
      isHelpful: feedbackTable.isHelpful,
      count: sql<number>`count(*)::int`,
    })
    .from(feedbackTable)
    .innerJoin(gapsTable, eq(feedbackTable.gapId, gapsTable.id))
    .groupBy(gapsTable.gapType, feedbackTable.isHelpful);

  const feedbackByType: Record<string, { helpful: number; notHelpful: number }> = {};
  for (const row of feedbackRaw) {
    if (!feedbackByType[row.gapType]) {
      feedbackByType[row.gapType] = { helpful: 0, notHelpful: 0 };
    }
    if (row.isHelpful === 1) {
      feedbackByType[row.gapType].helpful += row.count;
    } else {
      feedbackByType[row.gapType].notHelpful += row.count;
    }
  }

  const feedbackSummary = Object.entries(feedbackByType).map(([gapType, counts]) => {
    const total = counts.helpful + counts.notHelpful;
    return {
      gapType,
      helpfulCount: counts.helpful,
      notHelpfulCount: counts.notHelpful,
      helpfulnessRate: total > 0 ? Math.round((counts.helpful / total) * 100) / 100 : 0,
    };
  });

  const avgGapsPerAnalysis =
    totals.totalAnalyses > 0 ? totals.totalGaps / totals.totalAnalyses : 0;

  res.json({
    totalAnalyses: totals.totalAnalyses,
    totalGaps: totals.totalGaps,
    avgGapsPerAnalysis: Math.round(avgGapsPerAnalysis * 10) / 10,
    avgConfidence: Math.round(Number(totals.avgConfidence) * 100) / 100,
    totalFeedback,
    gapTypeBreakdown,
    severityBreakdown,
    feedbackSummary,
  });
});

// ── GET /api/analyses ────────────────────────────────────────────────────────
router.get("/analyses", async (_req, res): Promise<void> => {
  const analyses = await db
    .select()
    .from(analysesTable)
    .orderBy(sql`${analysesTable.createdAt} desc`);

  const result = await Promise.all(
    analyses.map(async (analysis) => {
      const gaps = await db
        .select({ severity: gapsTable.severity })
        .from(gapsTable)
        .where(eq(gapsTable.analysisId, analysis.id));

      return {
        ...analysis,
        createdAt: analysis.createdAt.toISOString(),
        gapCount: gaps.length,
        criticalCount: gaps.filter((g) => g.severity === "critical").length,
        highCount: gaps.filter((g) => g.severity === "high").length,
        mediumCount: gaps.filter((g) => g.severity === "medium").length,
        lowCount: gaps.filter((g) => g.severity === "low").length,
      };
    })
  );

  res.json(result);
});

// ── POST /api/analyses ───────────────────────────────────────────────────────
// Full pipeline: Logic Engine → GPT-4o → Merge → Store → Return
router.post("/analyses", async (req, res): Promise<void> => {
  const parsed = CreateAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { prdText, title } = parsed.data;

  // STEP 1: Run deterministic Logic Engine (~10ms, no API cost)
  const engineReport = await runLogicEngine(prdText);

  // STEP 2: Send enriched context to GPT-4o (graceful degradation on failure)
  let aiResult = { gaps: [] as Awaited<ReturnType<typeof analyzeWithAI>>["gaps"], aiSummary: "" };
  try {
    aiResult = await analyzeWithAI(prdText, engineReport);
  } catch (err) {
    logger.warn({ err }, "OpenAI analysis failed — using logic engine results only");
  }

  // STEP 3: Merge and deduplicate all gaps
  const mergedGaps = mergeGaps(engineReport, aiResult.gaps);

  // STEP 4: Store analysis in DB
  const [analysis] = await db
    .insert(analysesTable)
    .values({
      prdText: prdText.trim(),
      title: title.trim(),
      engineReport: JSON.stringify(engineReport),
      aiSummary: aiResult.aiSummary || null,
    })
    .returning();

  // STEP 5: Store all gaps
  const insertedGaps =
    mergedGaps.length > 0
      ? await db
          .insert(gapsTable)
          .values(
            mergedGaps.map((g) => ({
              analysisId: analysis.id,
              gapType: g.gapType,
              description: g.description,
              severity: g.severity,
              confidence: g.confidence,
              source: g.source,
              recommendation: g.recommendation,
            }))
          )
          .returning()
      : [];

  const gapsWithFeedback = insertedGaps.map((gap) => ({
    ...gap,
    createdAt: gap.createdAt.toISOString(),
    helpfulCount: 0,
    notHelpfulCount: 0,
  }));

  // STEP 6: Return full result
  res.status(201).json({
    ...analysis,
    createdAt: analysis.createdAt.toISOString(),
    engineReport: {
      confidence: engineReport.confidence,
      sections: engineReport.sections,
      summary: engineReport.summary,
      processingTimeMs: engineReport.processingTimeMs,
    },
    aiSummary: aiResult.aiSummary || null,
    gaps: gapsWithFeedback,
  });
});

// ── GET /api/analyses/:id ────────────────────────────────────────────────────
router.get("/analyses/:id", async (req, res): Promise<void> => {
  const params = GetAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [analysis] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.id, params.data.id));

  if (!analysis) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const gaps = await db
    .select()
    .from(gapsTable)
    .where(eq(gapsTable.analysisId, analysis.id))
    .orderBy(
      sql`case ${gapsTable.severity} when 'critical' then 1 when 'high' then 2 when 'medium' then 3 when 'low' then 4 end`
    );

  const gapsWithFeedback = await Promise.all(
    gaps.map(async (gap) => {
      const feedbackRows = await db
        .select({ isHelpful: feedbackTable.isHelpful })
        .from(feedbackTable)
        .where(eq(feedbackTable.gapId, gap.id));

      return {
        ...gap,
        createdAt: gap.createdAt.toISOString(),
        helpfulCount: feedbackRows.filter((f) => f.isHelpful === 1).length,
        notHelpfulCount: feedbackRows.filter((f) => f.isHelpful === 0).length,
      };
    })
  );

  const parsedEngineReport = analysis.engineReport
    ? JSON.parse(analysis.engineReport)
    : null;

  res.json({
    ...analysis,
    createdAt: analysis.createdAt.toISOString(),
    engineReport: parsedEngineReport,
    aiSummary: analysis.aiSummary ?? null,
    gaps: gapsWithFeedback,
  });
});

// ── DELETE /api/analyses/:id ─────────────────────────────────────────────────
router.delete("/analyses/:id", async (req, res): Promise<void> => {
  const params = DeleteAnalysisParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(analysesTable)
    .where(eq(analysesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  res.sendStatus(204);
});

// ── POST /api/gaps/:id/feedback ──────────────────────────────────────────────
router.post("/gaps/:id/feedback", async (req, res): Promise<void> => {
  const params = SubmitGapFeedbackParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SubmitGapFeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [gap] = await db
    .select({ id: gapsTable.id })
    .from(gapsTable)
    .where(eq(gapsTable.id, params.data.id));

  if (!gap) {
    res.status(404).json({ error: "Gap not found" });
    return;
  }

  const [feedback] = await db
    .insert(feedbackTable)
    .values({
      gapId: params.data.id,
      isHelpful: parsed.data.isHelpful ? 1 : 0,
    })
    .returning();

  res.status(201).json({
    ...feedback,
    createdAt: feedback.createdAt.toISOString(),
    isHelpful: feedback.isHelpful === 1,
  });
});

export default router;
