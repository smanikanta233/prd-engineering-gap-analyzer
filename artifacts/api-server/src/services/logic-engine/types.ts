export interface PRDPreProcessResult {
  isValidPRD: boolean;
  wordCount: number;
  charCount: number;
  lineCount: number;
  estimatedReadingTimeMinutes: number;
  languageWarnings: string[];
  cleanedText: string;
}

export interface SectionDetectResult {
  problemStatement: boolean;
  goal: boolean;
  scope: boolean;
  acceptanceCriteria: boolean;
  assumptions: boolean;
  edgeCases: boolean;
  dependencies: boolean;
  errorHandling: boolean;
  totalDetected: number;
  totalExpected: number;
  completenessPercent: number;
  missingSections: string[];
}

export interface AmbiguityFinding {
  word: string;
  context: string;
  lineNumber: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface AmbiguityDetectResult {
  findings: AmbiguityFinding[];
  totalFound: number;
  affectedLines: number[];
  ambiguityDensity: number;
}

export interface MissingLogicFinding {
  category: string;
  description: string;
  evidence: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface MissingLogicDetectResult {
  findings: MissingLogicFinding[];
  totalFound: number;
  hasErrorHandling: boolean;
  hasEdgeCases: boolean;
  hasStatusTransitions: boolean;
  hasRollbackPlan: boolean;
}

export interface UndefinedInputFinding {
  category: string;
  description: string;
  evidence: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface UndefinedInputDetectResult {
  findings: UndefinedInputFinding[];
  totalFound: number;
  missingFieldDefinitions: boolean;
  missingConstraints: boolean;
  missingFileTypeDefinitions: boolean;
  missingValidationRules: boolean;
}

export interface ConfidenceBreakdown {
  structureScore: number;
  clarityScore: number;
  completenessScore: number;
  totalScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  interpretation: string;
}

export interface EngineReport {
  preProcess: PRDPreProcessResult;
  sections: SectionDetectResult;
  ambiguity: AmbiguityDetectResult;
  missingLogic: MissingLogicDetectResult;
  undefinedInputs: UndefinedInputDetectResult;
  confidence: ConfidenceBreakdown;
  summary: {
    totalIssuesFound: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    topIssues: string[];
    readinessLabel: string;
  };
  analyzedAt: string;
  processingTimeMs: number;
}
