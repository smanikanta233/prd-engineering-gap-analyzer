import {
  PRDPreProcessResult,
  SectionDetectResult,
  AmbiguityDetectResult,
  MissingLogicDetectResult,
  UndefinedInputDetectResult,
  ConfidenceBreakdown,
  EngineReport,
} from './types.js';

function getReadinessLabel(score: number): string {
  if (score >= 90) return 'Ready';
  if (score >= 75) return 'Almost Ready';
  if (score >= 60) return 'Needs Work';
  return 'Not Ready';
}

function getAllFindings(
  ambiguity: AmbiguityDetectResult,
  missingLogic: MissingLogicDetectResult,
  undefinedInputs: UndefinedInputDetectResult,
) {
  return [
    ...ambiguity.findings.map(f => ({ severity: f.severity, description: `Ambiguity: "${f.word}" — ${f.suggestion}` })),
    ...missingLogic.findings.map(f => ({ severity: f.severity, description: `${f.category}: ${f.description}` })),
    ...undefinedInputs.findings.map(f => ({ severity: f.severity, description: `${f.category}: ${f.description}` })),
  ];
}

export function buildEngineReport(
  preProcess: PRDPreProcessResult,
  sections: SectionDetectResult,
  ambiguity: AmbiguityDetectResult,
  missingLogic: MissingLogicDetectResult,
  undefinedInputs: UndefinedInputDetectResult,
  confidence: ConfidenceBreakdown,
  processingTimeMs: number,
): EngineReport {
  const allFindings = getAllFindings(ambiguity, missingLogic, undefinedInputs);

  const criticalCount = allFindings.filter(f => f.severity === 'critical').length;
  const highCount = allFindings.filter(f => f.severity === 'high').length;
  const mediumCount = allFindings.filter(f => f.severity === 'medium').length;
  const lowCount = allFindings.filter(f => f.severity === 'low').length;
  const totalIssuesFound = allFindings.length;

  const topIssues = allFindings
    .filter(f => f.severity === 'critical' || f.severity === 'high')
    .slice(0, 3)
    .map(f => f.description);

  return {
    preProcess,
    sections,
    ambiguity,
    missingLogic,
    undefinedInputs,
    confidence,
    summary: {
      totalIssuesFound,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      topIssues,
      readinessLabel: getReadinessLabel(confidence.totalScore),
    },
    analyzedAt: new Date().toISOString(),
    processingTimeMs,
  };
}
