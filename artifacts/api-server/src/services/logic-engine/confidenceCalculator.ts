import {
  SectionDetectResult,
  AmbiguityDetectResult,
  MissingLogicDetectResult,
  UndefinedInputDetectResult,
  ConfidenceBreakdown,
} from './types.js';

export function calculateConfidence(
  sections: SectionDetectResult,
  ambiguity: AmbiguityDetectResult,
  missingLogic: MissingLogicDetectResult,
  undefinedInputs: UndefinedInputDetectResult,
): ConfidenceBreakdown {

  const structureScore = Math.round((sections.completenessPercent / 100) * 40);

  const clarityDeduction = Math.min(30, Math.round(ambiguity.ambiguityDensity * 30));
  const criticalAmbiguities = ambiguity.findings.filter(f => f.severity === 'critical').length;
  const criticalDeduction = Math.min(15, criticalAmbiguities * 3);
  const clarityScore = Math.max(0, 30 - clarityDeduction - criticalDeduction);

  const allIssues = [...missingLogic.findings, ...undefinedInputs.findings];
  let completenessDeduction = 0;
  for (const issue of allIssues) {
    switch (issue.severity) {
      case 'critical': completenessDeduction += 8; break;
      case 'high':     completenessDeduction += 5; break;
      case 'medium':   completenessDeduction += 3; break;
      case 'low':      completenessDeduction += 1; break;
    }
  }
  const completenessScore = Math.max(0, 30 - completenessDeduction);

  const totalScore = structureScore + clarityScore + completenessScore;

  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  let interpretation: string;

  if (totalScore >= 90) {
    grade = 'A';
    interpretation = 'Excellent PRD. Ready for engineering handoff with minor polish.';
  } else if (totalScore >= 75) {
    grade = 'B';
    interpretation = 'Good PRD. A few gaps to address before engineering begins.';
  } else if (totalScore >= 60) {
    grade = 'C';
    interpretation = 'Acceptable PRD but significant gaps exist. Review recommended before handoff.';
  } else if (totalScore >= 40) {
    grade = 'D';
    interpretation = 'Weak PRD. Multiple critical gaps detected. Substantial revision needed.';
  } else {
    grade = 'F';
    interpretation = 'PRD is not ready for engineering. Critical sections and definitions are missing.';
  }

  return {
    structureScore,
    clarityScore,
    completenessScore,
    totalScore,
    grade,
    interpretation,
  };
}
