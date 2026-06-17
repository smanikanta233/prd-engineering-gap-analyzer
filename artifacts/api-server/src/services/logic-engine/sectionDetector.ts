import { SectionDetectResult } from './types.js';

type SectionKey = 'problemStatement' | 'goal' | 'scope' | 'acceptanceCriteria' | 'assumptions' | 'edgeCases' | 'dependencies' | 'errorHandling';

const SECTION_PATTERNS: Record<SectionKey, RegExp[]> = {
  problemStatement: [
    /#{1,3}\s*(problem|background|context|overview|motivation)/i,
    /\b(problem statement|background|the problem|current situation)\b/i,
  ],
  goal: [
    /#{1,3}\s*(goal|objective|purpose|aim)/i,
    /\b(goal[s]?|objective[s]?|success criteri|desired outcome)\b/i,
  ],
  scope: [
    /#{1,3}\s*(scope|in scope|out of scope)/i,
    /\b(in scope|out of scope|included|excluded|boundaries)\b/i,
  ],
  acceptanceCriteria: [
    /#{1,3}\s*(acceptance criteria|acceptance test|definition of done)/i,
    /\b(acceptance criteria|done when|complete when|verified when|definition of done)\b/i,
  ],
  assumptions: [
    /#{1,3}\s*(assumption|constraint|prerequisite)/i,
    /\b(assumption[s]?|we assume|it is assumed|prerequisite[s]?)\b/i,
  ],
  edgeCases: [
    /#{1,3}\s*(edge case|corner case|exception|special case)/i,
    /\b(edge case[s]?|corner case[s]?|exception[s]?|what if|boundary condition)\b/i,
  ],
  dependencies: [
    /#{1,3}\s*(dependenc|integration|third.party|external)/i,
    /\b(depend[s]? on|depends upon|integration with|third.party|external service|upstream|downstream)\b/i,
  ],
  errorHandling: [
    /#{1,3}\s*(error|failure|fallback|recovery)/i,
    /\b(error handling|error state[s]?|failure scenario|fallback|retry|timeout|exception handling)\b/i,
  ],
};

const SECTION_LABELS: Record<SectionKey, string> = {
  problemStatement: 'Problem Statement',
  goal: 'Goals / Objectives',
  scope: 'Scope',
  acceptanceCriteria: 'Acceptance Criteria',
  assumptions: 'Assumptions',
  edgeCases: 'Edge Cases',
  dependencies: 'Dependencies',
  errorHandling: 'Error Handling',
};

export function detectSections(text: string): SectionDetectResult {
  const results = {} as Record<SectionKey, boolean>;

  for (const [section, patterns] of Object.entries(SECTION_PATTERNS) as [SectionKey, RegExp[]][]) {
    results[section] = patterns.some(pattern => pattern.test(text));
  }

  const totalExpected = Object.keys(SECTION_PATTERNS).length;
  const totalDetected = Object.values(results).filter(Boolean).length;
  const missingSections = (Object.entries(results) as [SectionKey, boolean][])
    .filter(([, found]) => !found)
    .map(([key]) => SECTION_LABELS[key]);

  return {
    ...results,
    totalDetected,
    totalExpected,
    completenessPercent: Math.round((totalDetected / totalExpected) * 100),
    missingSections,
  };
}
