import { EngineReport } from './logic-engine/types.js';
import { AIGap } from './openai/prdAnalyzer.js';

export interface UnifiedGap {
  gapType: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  recommendation: string;
  source: 'logic-engine' | 'ai';
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const MAX_TOTAL_GAPS = 15;

function severityToConfidence(severity: string): number {
  switch (severity) {
    case 'critical': return 0.95;
    case 'high':     return 0.85;
    case 'medium':   return 0.70;
    case 'low':      return 0.60;
    default:         return 0.65;
  }
}

function engineReportToGaps(report: EngineReport): UnifiedGap[] {
  const gaps: UnifiedGap[] = [];

  for (const section of report.sections.missingSections) {
    const isCritical = section === 'Acceptance Criteria' || section === 'Error Handling';
    gaps.push({
      gapType: 'Missing Section',
      description: `Required PRD section "${section}" is missing.`,
      severity: isCritical ? 'critical' : 'high',
      confidence: 0.99,
      recommendation: `Add a "${section}" section to the PRD before engineering handoff.`,
      source: 'logic-engine',
    });
  }

  const significantAmbiguities = report.ambiguity.findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high',
  );
  const seenSuggestions = new Set<string>();
  for (const finding of significantAmbiguities) {
    if (!seenSuggestions.has(finding.suggestion)) {
      seenSuggestions.add(finding.suggestion);
      gaps.push({
        gapType: 'Ambiguous Requirement',
        description: `Vague term "${finding.word}" used on line ${finding.lineNumber}: "${finding.context}"`,
        severity: finding.severity,
        confidence: severityToConfidence(finding.severity),
        recommendation: finding.suggestion,
        source: 'logic-engine',
      });
    }
  }

  for (const finding of report.missingLogic.findings) {
    gaps.push({
      gapType: finding.category,
      description: finding.description,
      severity: finding.severity,
      confidence: severityToConfidence(finding.severity),
      recommendation: finding.recommendation,
      source: 'logic-engine',
    });
  }

  for (const finding of report.undefinedInputs.findings) {
    gaps.push({
      gapType: finding.category,
      description: finding.description,
      severity: finding.severity,
      confidence: severityToConfidence(finding.severity),
      recommendation: finding.recommendation,
      source: 'logic-engine',
    });
  }

  return gaps;
}

function isDuplicate(aiGap: AIGap, existingGaps: UnifiedGap[]): boolean {
  const aiWords = new Set(aiGap.description.toLowerCase().split(/\s+/));
  for (const existing of existingGaps) {
    const existingWords = existing.description.toLowerCase().split(/\s+/);
    const overlap = existingWords.filter((w) => w.length > 4 && aiWords.has(w)).length;
    const overlapRatio = overlap / Math.min(aiWords.size, existingWords.length);
    if (overlapRatio > 0.5) return true;
  }
  return false;
}

export function mergeGaps(engineReport: EngineReport, aiGaps: AIGap[]): UnifiedGap[] {
  const logicGaps = engineReportToGaps(engineReport);

  const mergedAIGaps: UnifiedGap[] = aiGaps
    .filter((g) => !isDuplicate(g, logicGaps))
    .map((g) => ({
      gapType: g.gapType,
      description: g.description,
      severity: g.severity,
      confidence: g.confidence,
      recommendation: g.recommendation,
      source: 'ai' as const,
    }));

  const allGaps = [...logicGaps, ...mergedAIGaps];

  allGaps.sort((a, b) => {
    const severityDiff = (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4);
    if (severityDiff !== 0) return severityDiff;
    return b.confidence - a.confidence;
  });

  return allGaps.slice(0, MAX_TOTAL_GAPS);
}
