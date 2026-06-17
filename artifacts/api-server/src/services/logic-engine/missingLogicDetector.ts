import { MissingLogicFinding, MissingLogicDetectResult } from './types.js';

export function detectMissingLogic(text: string): MissingLogicDetectResult {
  const findings: MissingLogicFinding[] = [];

  const hasErrorHandling = /error\s*handling|failure\s*(scenario|case|mode)|fallback|retry\s*logic|on\s*error|exception\s*handling|error\s*state/i.test(text);
  if (!hasErrorHandling) {
    findings.push({
      category: 'Missing Error Handling',
      description: 'The PRD does not define what happens when operations fail.',
      evidence: 'No error handling, fallback, or failure scenario section detected.',
      severity: 'critical',
      recommendation: 'Add an "Error Handling" section defining: failure scenarios, retry behaviour, fallback states, and user-facing error messages.',
    });
  }

  const hasEdgeCases = /edge\s*case|corner\s*case|boundary\s*(condition|value)|what\s*if|exception\s*flow|special\s*case/i.test(text);
  if (!hasEdgeCases) {
    findings.push({
      category: 'Missing Edge Cases',
      description: 'No edge cases or boundary conditions are defined.',
      evidence: 'No edge case, corner case, or boundary condition section detected.',
      severity: 'high',
      recommendation: 'Add an "Edge Cases" section covering: empty inputs, maximum limits, concurrent access, and network interruptions.',
    });
  }

  const hasStatusTransitions = /status\s*transition|state\s*(machine|diagram|flow|change)|workflow\s*state|from\s+\w+\s+to\s+\w+|state:\s*\w+/i.test(text);
  const impliesStatefulSystem = /status|state|pending|approved|rejected|active|inactive|processing|completed|failed|cancelled/i.test(text);
  if (impliesStatefulSystem && !hasStatusTransitions) {
    findings.push({
      category: 'Missing Status Transitions',
      description: 'The PRD mentions states/statuses but does not define the transition rules between them.',
      evidence: 'Status-related terms detected but no state transition diagram or rules found.',
      severity: 'high',
      recommendation: 'Add a state transition table or diagram showing: all possible states, valid transitions, who/what triggers each transition, and invalid transition handling.',
    });
  }

  const hasRollbackPlan = /rollback|undo|revert|reverse|compensat|undo\s*action/i.test(text);
  const impliesDataMutation = /create|update|delete|insert|modify|write|submit|save|upload|migrate/i.test(text);
  if (impliesDataMutation && !hasRollbackPlan) {
    findings.push({
      category: 'Missing Rollback Plan',
      description: 'The PRD describes data-mutating operations but does not define rollback or recovery procedures.',
      evidence: 'Data mutation verbs detected (create/update/delete) but no rollback plan found.',
      severity: 'high',
      recommendation: 'Define rollback behaviour for each mutating operation. What happens if a multi-step operation fails halfway through?',
    });
  }

  const hasAcceptanceCriteria = /acceptance\s*criteri|definition\s*of\s*done|done\s*when|complete\s*when|verified\s*when|passed\s*when/i.test(text);
  if (!hasAcceptanceCriteria) {
    findings.push({
      category: 'Missing Acceptance Criteria',
      description: 'There are no explicit acceptance criteria to define when this feature is complete.',
      evidence: 'No acceptance criteria or definition of done section detected.',
      severity: 'critical',
      recommendation: 'Add "Acceptance Criteria" as a numbered list of testable conditions. Each item should be verifiable by QA without subjective interpretation.',
    });
  }

  const hasPerformanceBounds = /timeout|sla|latency|response\s*time|<\s*\d+\s*(ms|sec|s\b|minute)|within\s*\d+/i.test(text);
  const impliesNetworkOps = /api|request|response|fetch|call|endpoint|service|webhook|http/i.test(text);
  if (impliesNetworkOps && !hasPerformanceBounds) {
    findings.push({
      category: 'Missing Performance Boundaries',
      description: 'The PRD involves network/API operations but defines no timeout or performance SLA.',
      evidence: 'API/network terms detected but no timeout values or response time requirements found.',
      severity: 'medium',
      recommendation: 'Define: maximum acceptable response time, timeout threshold, and behaviour when the timeout is exceeded.',
    });
  }

  const hasAuthSpec = /auth(entication|orization|oriz[es])|permission|role|access\s*control|who\s*can|only\s*(admin|user|owner)/i.test(text);
  const impliesUserAccess = /user|login|sign\s*in|account|profile|dashboard|access/i.test(text);
  if (impliesUserAccess && !hasAuthSpec) {
    findings.push({
      category: 'Missing Authentication / Authorization Spec',
      description: 'The PRD references user access but does not specify authentication or authorization rules.',
      evidence: 'User/access terms detected but no auth specification found.',
      severity: 'high',
      recommendation: 'Specify: who can access this feature, what roles exist, and what happens when an unauthorized user attempts access.',
    });
  }

  return {
    findings,
    totalFound: findings.length,
    hasErrorHandling,
    hasEdgeCases,
    hasStatusTransitions,
    hasRollbackPlan,
  };
}
