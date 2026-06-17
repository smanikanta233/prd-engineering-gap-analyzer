import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analysesTable = pgTable("analyses", {
  id: serial("id").primaryKey(),
  prdText: text("prd_text").notNull(),
  title: text("title").notNull().default("Untitled PRD"),
  engineReport: text("engine_report"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAnalysisSchema = createInsertSchema(analysesTable).omit({ id: true, createdAt: true });
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analysesTable.$inferSelect;

export const gapsTable = pgTable("gaps", {
  id: serial("id").primaryKey(),
  analysisId: integer("analysis_id").notNull().references(() => analysesTable.id, { onDelete: "cascade" }),
  gapType: text("gap_type").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull(), // critical | high | medium | low
  confidence: real("confidence").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGapSchema = createInsertSchema(gapsTable).omit({ id: true, createdAt: true });
export type InsertGap = z.infer<typeof insertGapSchema>;
export type Gap = typeof gapsTable.$inferSelect;

export const feedbackTable = pgTable("feedback", {
  id: serial("id").primaryKey(),
  gapId: integer("gap_id").notNull().references(() => gapsTable.id, { onDelete: "cascade" }),
  isHelpful: integer("is_helpful").notNull(), // 1 = helpful, 0 = not helpful
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFeedbackSchema = createInsertSchema(feedbackTable).omit({ id: true, createdAt: true });
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedbackTable.$inferSelect;
