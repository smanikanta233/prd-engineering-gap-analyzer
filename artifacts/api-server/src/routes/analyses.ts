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
import { analyzePrd } from "../lib/openai";
import { logger } from "../lib/logger";

const router: IRouter = Router();

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

  // Gap type breakdown with avg confidence and most common severity
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

  // Feedback summary by gap type
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

      const gapCount = gaps.length;
      const criticalCount = gaps.filter((g) => g.severity === "critical").length;
      const highCount = gaps.filter((g) => g.severity === "high").length;
      const mediumCount = gaps.filter((g) => g.severity === "medium").length;
      const lowCount = gaps.filter((g) => g.severity === "low").length;

      return {
        ...analysis,
        createdAt: analysis.createdAt.toISOString(),
        gapCount,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
      };
    })
  );

  res.json(result);
});

router.post("/analyses", async (req, res): Promise<void> => {
  const parsed = CreateAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { prdText, title: userTitle } = parsed.data;

  let analysisResult;
  try {
    analysisResult = await analyzePrd(prdText);
  } catch (err) {
    logger.error({ err }, "OpenAI analysis failed");
    res.status(500).json({ error: "Failed to analyze PRD. Please try again." });
    return;
  }

  // Use user-provided title; fall back to AI-generated title
  const title = (userTitle && userTitle.trim().length >= 3)
    ? userTitle.trim()
    : analysisResult.title;

  const [analysis] = await db
    .insert(analysesTable)
    .values({ prdText, title })
    .returning();

  const gapsToInsert = analysisResult.gaps.map((gap) => ({
    analysisId: analysis.id,
    gapType: gap.gapType,
    description: gap.description,
    severity: gap.severity,
    confidence: gap.confidence,
  }));

  const insertedGaps =
    gapsToInsert.length > 0
      ? await db.insert(gapsTable).values(gapsToInsert).returning()
      : [];

  const gapsWithFeedback = insertedGaps.map((gap) => ({
    ...gap,
    createdAt: gap.createdAt.toISOString(),
    helpfulCount: 0,
    notHelpfulCount: 0,
  }));

  res.status(201).json({
    ...analysis,
    createdAt: analysis.createdAt.toISOString(),
    gaps: gapsWithFeedback,
  });
});

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

  res.json({
    ...analysis,
    createdAt: analysis.createdAt.toISOString(),
    gaps: gapsWithFeedback,
  });
});

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
