import { openai } from '../../lib/openai.js';
import { EngineReport } from '../logic-engine/types.js';

export interface AIGap {
  gapType: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  recommendation: string;
  source: 'ai';
}

const MAX_AI_GAPS = 10;
const MIN_CONFIDENCE = 0.65;

const SYSTEM_PROMPT = `You are a senior software engineering consultant specializing in PRD (Product Requirements Document) review.

You will receive:
1. The original PRD text
2. A structured diagnostic report from a deterministic logic engine that has already detected structural issues

Your job is to find ADDITIONAL gaps that the logic engine cannot detect through pattern matching alone — specifically:
- Business logic contradictions or impossibilities
- Missing domain-specific requirements (security, compliance, data privacy)
- Unclear user flows or missing user journey steps
- Technical feasibility concerns
- Integration risks not mentioned
- Missing non-functional requirements (availability, disaster recovery, data retention)
- Semantic ambiguities that need domain knowledge to identify

DO NOT repeat findings already identified in the logic engine report.
DO NOT flag obvious issues the logic engine already caught (missing sections, vague words like "fast/scalable").
Focus ONLY on semantic, domain-level, and business logic gaps.

STRICT RULES:
- Return ONLY valid JSON, no markdown, no explanation text outside JSON
- Maximum ${MAX_AI_GAPS} gaps
- Only include gaps with confidence >= ${MIN_CONFIDENCE}
- Every gap must have a concrete, actionable recommendation
- severity must be exactly one of: "critical", "high", "medium", "low"
- confidence must be a number between 0.0 and 1.0

Return this exact JSON structure:
{
  "gaps": [
    {
      "gapType": "string (category name, e.g. Security Gap, Compliance Risk, Business Logic Flaw)",
      "description": "string (specific description of the gap)",
      "severity": "critical|high|medium|low",
      "confidence": 0.0-1.0,
      "recommendation": "string (concrete actionable fix)"
    }
  ],
  "aiSummary": "string (2-3 sentence overall assessment from AI perspective, complementing the logic engine findings)"
}`;

function buildUserPrompt(prdText: string, report: EngineReport): string {
  return `## ORIGINAL PRD TEXT
${prdText}

---

## LOGIC ENGINE DIAGNOSTIC REPORT (already detected — DO NOT repeat these)

**PRD Readiness Score: ${report.confidence.totalScore}/100 (Grade: ${report.confidence.grade})**
**Readiness Label: ${report.summary.readinessLabel}**

**Sections detected (${report.sections.totalDetected}/${report.sections.totalExpected}):**
${report.sections.missingSections.length > 0 ? `Missing: ${report.sections.missingSections.join(', ')}` : 'All sections present'}

**Ambiguity findings already flagged (${report.ambiguity.totalFound} total):**
${report.ambiguity.findings.slice(0, 5).map(f => `- "${f.word}" on line ${f.lineNumber} (${f.severity})`).join('\n')}
${report.ambiguity.totalFound > 5 ? `...and ${report.ambiguity.totalFound - 5} more` : ''}

**Missing logic already detected:**
${report.missingLogic.findings.map(f => `- ${f.category} (${f.severity})`).join('\n') || 'None'}

**Undefined inputs already detected:**
${report.undefinedInputs.findings.map(f => `- ${f.category} (${f.severity})`).join('\n') || 'None'}

---

Now identify ADDITIONAL semantic and domain-level gaps NOT already covered above.`;
}

export async function analyzeWithAI(
  prdText: string,
  engineReport: EngineReport,
): Promise<{ gaps: AIGap[]; aiSummary: string }> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.2,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(prdText, engineReport) },
    ],
  });

  const rawContent = response.choices[0]?.message?.content ?? '';

  let parsed: { gaps: AIGap[]; aiSummary: string };
  try {
    const clean = rawContent.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(`GPT-4o returned invalid JSON: ${rawContent.substring(0, 200)}`);
  }

  const validGaps = (parsed.gaps ?? [])
    .filter(
      (g) =>
        g.gapType &&
        g.description &&
        ['critical', 'high', 'medium', 'low'].includes(g.severity) &&
        typeof g.confidence === 'number' &&
        g.confidence >= MIN_CONFIDENCE &&
        g.recommendation,
    )
    .slice(0, MAX_AI_GAPS)
    .map((g) => ({ ...g, source: 'ai' as const }));

  return {
    gaps: validGaps,
    aiSummary: parsed.aiSummary ?? '',
  };
}
