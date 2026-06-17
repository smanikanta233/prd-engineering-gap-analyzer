import { preProcessPRD } from './prdPreProcessor.js';
import { detectSections } from './sectionDetector.js';
import { detectAmbiguity } from './ambiguityDetector.js';
import { detectMissingLogic } from './missingLogicDetector.js';
import { detectUndefinedInputs } from './undefinedInputDetector.js';
import { calculateConfidence } from './confidenceCalculator.js';
import { buildEngineReport } from './engineReport.js';
import { EngineReport } from './types.js';

export async function runLogicEngine(rawPRDText: string): Promise<EngineReport> {
  const startTime = Date.now();

  const preProcess = preProcessPRD(rawPRDText);
  const textToAnalyze = preProcess.cleanedText;

  const sections = detectSections(textToAnalyze);
  const ambiguity = detectAmbiguity(textToAnalyze);
  const missingLogic = detectMissingLogic(textToAnalyze);
  const undefinedInputs = detectUndefinedInputs(textToAnalyze);

  const confidence = calculateConfidence(sections, ambiguity, missingLogic, undefinedInputs);

  const processingTimeMs = Date.now() - startTime;
  const report = buildEngineReport(
    preProcess,
    sections,
    ambiguity,
    missingLogic,
    undefinedInputs,
    confidence,
    processingTimeMs,
  );

  return report;
}

export type { EngineReport } from './types.js';
