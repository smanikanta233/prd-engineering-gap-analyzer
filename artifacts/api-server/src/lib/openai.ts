import OpenAI from "openai";
import { logger } from "./logger";

if (!process.env.OPENAI_API_KEY) {
  logger.warn("OPENAI_API_KEY is not set");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GapResult {
  gapType: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;
}

export interface AnalysisResult {
  title: string;
  gaps: GapResult[];
}

const SYSTEM_PROMPT = `You are an expert engineering reviewer specializing in identifying gaps in Product Requirements Documents (PRDs).

Analyze the provided PRD and identify engineering gaps across these categories:
- Missing Technical Spec: Undefined technical requirements, protocols, or constraints
- Security Concern: Authentication, authorization, data protection, or compliance gaps
- Scalability Issue: Missing performance requirements, load handling, or growth planning
- Ambiguous Requirement: Vague or contradictory requirements that engineers cannot implement
- Missing Error Handling: Undefined failure modes, edge cases, or recovery procedures
- Integration Gap: Undefined third-party dependencies, API contracts, or data flows
- Data Model Issue: Missing or unclear data structures, validation rules, or persistence requirements
- Performance Requirement: Missing latency, throughput, or resource usage specifications
- Missing Acceptance Criteria: Features without testable success conditions
- Operational Concern: Missing monitoring, alerting, deployment, or maintenance requirements

Return a JSON object with this exact structure:
{
  "title": "A concise title for this PRD (max 60 chars)",
  "gaps": [
    {
      "gapType": "one of the categories above",
      "description": "Clear, specific description of the gap and why it matters to engineering (2-3 sentences)",
      "severity": "critical | high | medium | low",
      "confidence": 0.0-1.0
    }
  ]
}

Severity guidelines:
- critical: Blocker — cannot ship without resolving this
- high: Significant risk to delivery or product quality
- medium: Should be addressed before launch but workable
- low: Nice to have / minor clarification needed

Be specific and actionable. Focus on what's missing, not what's present. Return 5-15 gaps depending on the PRD's completeness.`;

export async function analyzePrd(prdText: string): Promise<AnalysisResult> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 4000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Please analyze this PRD for engineering gaps:\n\n${prdText}` },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  const result = JSON.parse(content) as AnalysisResult;

  if (!result.title || !Array.isArray(result.gaps)) {
    throw new Error("Invalid response structure from OpenAI");
  }

  result.gaps = result.gaps.map((gap) => ({
    ...gap,
    confidence: Math.max(0, Math.min(1, gap.confidence)),
  }));

  return result;
}
