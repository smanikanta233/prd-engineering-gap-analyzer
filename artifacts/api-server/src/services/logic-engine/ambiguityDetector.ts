import { AmbiguityFinding, AmbiguityDetectResult } from './types.js';

interface AmbiguityRule {
  words: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  suggestion: string;
}

const AMBIGUITY_RULES: AmbiguityRule[] = [
  {
    words: ['fast', 'quickly', 'rapid', 'speedy', 'instantaneous', 'real-time', 'real time'],
    severity: 'critical',
    suggestion: 'Replace with a measurable metric. Example: "response time < 200ms" or "process within 2 seconds"',
  },
  {
    words: ['scalable', 'scalability', 'scale'],
    severity: 'critical',
    suggestion: 'Define scale targets. Example: "must support 10,000 concurrent users" or "handle 1M records without degradation"',
  },
  {
    words: ['user-friendly', 'user friendly', 'intuitive', 'easy to use', 'simple', 'straightforward'],
    severity: 'high',
    suggestion: 'Replace with measurable UX criteria. Example: "task completion in < 3 clicks" or "onboarding in < 5 minutes"',
  },
  {
    words: ['seamless', 'smooth', 'frictionless'],
    severity: 'high',
    suggestion: 'Define what seamless means technically. Example: "no page reload required" or "zero-downtime migration"',
  },
  {
    words: ['optimized', 'optimize', 'efficient', 'performant'],
    severity: 'high',
    suggestion: 'Specify the optimization target and metric. Example: "reduce API response time by 30%" or "CPU usage < 70% under peak load"',
  },
  {
    words: ['etc', 'and so on', 'and more', 'among others', 'similar'],
    severity: 'critical',
    suggestion: 'Enumerate all items explicitly. "Etc." in a PRD signals incomplete requirements.',
  },
  {
    words: ['some', 'several', 'many', 'few', 'various', 'multiple', 'appropriate', 'sufficient'],
    severity: 'medium',
    suggestion: 'Replace with exact quantities. Example: "3 retry attempts" instead of "several retries"',
  },
  {
    words: ['should', 'could', 'might', 'may', 'ideally', 'preferably', 'if possible'],
    severity: 'medium',
    suggestion: 'Use "must" or "shall" for required behaviour. "Should" is ambiguous — is it mandatory or optional?',
  },
  {
    words: ['tbd', 'to be determined', 'to be defined', 'to be decided', 'tba'],
    severity: 'critical',
    suggestion: 'TBD is a blocker. Resolve this before engineering begins or explicitly defer it to a future PRD version.',
  },
  {
    words: ['good', 'great', 'better', 'best', 'high quality', 'high-quality', 'robust'],
    severity: 'low',
    suggestion: 'Define quality in measurable terms. Example: "99.9% uptime" instead of "robust system"',
  },
  {
    words: ['large', 'small', 'big', 'huge', 'tiny', 'significant', 'minimal', 'substantial'],
    severity: 'medium',
    suggestion: 'Replace relative size terms with absolute values or ranges.',
  },
  {
    words: ['soon', 'later', 'eventually', 'in the future', 'at some point', 'shortly'],
    severity: 'high',
    suggestion: 'Replace with a specific date, sprint, or milestone.',
  },
];

function getSentenceContext(lines: string[], lineIndex: number): string {
  const line = lines[lineIndex].trim();
  return line.length > 120 ? line.substring(0, 120) + '...' : line;
}

export function detectAmbiguity(text: string): AmbiguityDetectResult {
  const lines = text.split('\n');
  const findings: AmbiguityFinding[] = [];
  const affectedLines = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    for (const rule of AMBIGUITY_RULES) {
      for (const word of rule.words) {
        const escaped = word.replace(/[-\s]/g, '[\\s\\-]');
        const regex = new RegExp(`\\b${escaped}\\b`, 'i');
        if (regex.test(lineLower)) {
          const isDuplicate = findings.some(
            f => f.word.toLowerCase() === word.toLowerCase() && f.lineNumber === i + 1
          );
          if (!isDuplicate) {
            findings.push({
              word,
              context: getSentenceContext(lines, i),
              lineNumber: i + 1,
              severity: rule.severity,
              suggestion: rule.suggestion,
            });
            affectedLines.add(i + 1);
          }
        }
      }
    }
  }

  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const ambiguityDensity = wordCount > 0
    ? Math.round((findings.length / wordCount) * 100 * 100) / 100
    : 0;

  return {
    findings,
    totalFound: findings.length,
    affectedLines: Array.from(affectedLines).sort((a, b) => a - b),
    ambiguityDensity,
  };
}
