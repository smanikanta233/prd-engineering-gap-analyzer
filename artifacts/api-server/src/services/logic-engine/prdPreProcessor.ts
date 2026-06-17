import { PRDPreProcessResult } from './types.js';

const MIN_WORD_COUNT = 50;
const MIN_HEADING_COUNT = 1;

export function preProcessPRD(rawText: string): PRDPreProcessResult {
  const warnings: string[] = [];

  const cleanedText = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/[ ]{3,}/g, '  ')
    .trim();

  const lines = cleanedText.split('\n');
  const words = cleanedText.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const charCount = cleanedText.length;
  const lineCount = lines.length;
  const estimatedReadingTimeMinutes = Math.ceil(wordCount / 200);

  if (wordCount < MIN_WORD_COUNT) {
    warnings.push(`PRD is too short (${wordCount} words). A meaningful PRD should have at least ${MIN_WORD_COUNT} words.`);
  }

  const headingLines = lines.filter(l =>
    /^#{1,3}\s/.test(l) ||
    /^[A-Z][A-Z\s]{4,}:?\s*$/.test(l.trim())
  );

  if (headingLines.length < MIN_HEADING_COUNT) {
    warnings.push('No section headings detected. A PRD should have clearly labelled sections.');
  }

  if (charCount < 200) {
    warnings.push('Document is too brief to contain meaningful requirements.');
  }

  const prdKeywords = ['require', 'must', 'should', 'shall', 'user', 'system', 'feature', 'function', 'input', 'output'];
  const foundKeywords = prdKeywords.filter(k => cleanedText.toLowerCase().includes(k));
  const isValidPRD = foundKeywords.length >= 3 && wordCount >= MIN_WORD_COUNT;

  if (!isValidPRD && foundKeywords.length < 3) {
    warnings.push('Document does not appear to be a PRD. Missing requirement-related language.');
  }

  return {
    isValidPRD,
    wordCount,
    charCount,
    lineCount,
    estimatedReadingTimeMinutes,
    languageWarnings: warnings,
    cleanedText,
  };
}
