import { UndefinedInputFinding, UndefinedInputDetectResult } from './types.js';

export function detectUndefinedInputs(text: string): UndefinedInputDetectResult {
  const findings: UndefinedInputFinding[] = [];

  const mentionsFileUpload = /upload|file\s*upload|attach(ment)?|import\s*file/i.test(text);
  const hasFileConstraints = /file\s*type|file\s*format|allowed\s*(format|type|extension)|\.jpg|\.png|\.pdf|\.csv|max\s*(file\s*)?size|file\s*size\s*limit/i.test(text);
  if (mentionsFileUpload && !hasFileConstraints) {
    findings.push({
      category: 'Missing File Type Definition',
      description: 'File upload is mentioned but allowed file types and size limits are not defined.',
      evidence: 'Upload/file attachment detected without format or size constraints.',
      severity: 'high',
      recommendation: 'Specify: allowed file types (e.g. PDF, CSV, JPG), maximum file size, and behaviour when an invalid file is uploaded.',
    });
  }

  const mentionsForm = /form|input\s*field|text\s*field|input:|field:|enter\s+(your|the|a)\s+\w+/i.test(text);
  const hasValidationRules = /validat|required\s*field|max\s*(length|char)|min\s*(length|char)|must\s*be\s*(a\s*)?(number|string|email|date)|format:|regex|pattern/i.test(text);
  if (mentionsForm && !hasValidationRules) {
    findings.push({
      category: 'Missing Validation Rules',
      description: 'Form fields or inputs are described but no validation rules are defined.',
      evidence: 'Input fields detected without validation specifications.',
      severity: 'critical',
      recommendation: 'For each input field define: required/optional, data type, min/max length, format (e.g. email regex), and error message when validation fails.',
    });
  }

  const mentionsPagination = /paginat|page\s*size|per\s*page|load\s*more|infinite\s*scroll|next\s*page/i.test(text);
  const hasPaginationSpec = /(\d+)\s*(items?|results?|records?)\s*(per\s*page|per\s*load)|page\s*size\s*(of|=|:)\s*\d+/i.test(text);
  if (mentionsPagination && !hasPaginationSpec) {
    findings.push({
      category: 'Missing Pagination Constraints',
      description: 'Pagination is mentioned but page size limits are not defined.',
      evidence: 'Pagination terms detected without specific page size values.',
      severity: 'medium',
      recommendation: 'Define: default page size, maximum page size, and behaviour at the last page.',
    });
  }

  const mentionsSearch = /search|filter|query|look\s*up|find\s+(a\s+)?\w+/i.test(text);
  const hasSearchSpec = /search\s*result|max\s*(result|match)|result\s*limit|ranking|relevance|sort\s*(by|order)/i.test(text);
  if (mentionsSearch && !hasSearchSpec) {
    findings.push({
      category: 'Missing Search / Filter Specification',
      description: 'Search or filter functionality is mentioned but result limits and ranking are not defined.',
      evidence: 'Search terms detected without result limit or ranking rules.',
      severity: 'medium',
      recommendation: 'Define: maximum results returned, sort/ranking logic, behaviour when no results found, and minimum character requirement for search.',
    });
  }

  const mentionsDateTime = /date|time|timestamp|schedule|deadline|expir|due\s*date/i.test(text);
  const hasDateSpec = /utc|gmt|timezone|time\s*zone|iso\s*8601|yyyy|dd\/mm|mm\/dd|unix\s*timestamp|epoch/i.test(text);
  if (mentionsDateTime && !hasDateSpec) {
    findings.push({
      category: 'Missing Date / Time Format Specification',
      description: 'Date or time fields are mentioned but format and timezone are not specified.',
      evidence: 'Date/time references detected without format or timezone definition.',
      severity: 'high',
      recommendation: 'Specify: date format (ISO 8601 recommended), timezone handling (store as UTC, display in user timezone), and date range constraints.',
    });
  }

  const mentionsNotification = /notif(y|ication)|alert|email\s*(user|customer)|send\s*(an?\s*)?(email|sms|push)|remind/i.test(text);
  const hasNotificationSpec = /trigger(ed)?\s*(when|by|on|after)|notification\s*(type|channel|frequency)|email\s*template|push\s*notif|sms\s*notif|unsubscribe|opt.out/i.test(text);
  if (mentionsNotification && !hasNotificationSpec) {
    findings.push({
      category: 'Missing Notification Specification',
      description: 'Notifications are mentioned but triggers, channels, and frequency are not defined.',
      evidence: 'Notification terms detected without trigger conditions or channel specifications.',
      severity: 'high',
      recommendation: 'Define for each notification: trigger condition, delivery channel (email/SMS/push), template content, frequency limits, and opt-out mechanism.',
    });
  }

  const mentionsAPI = /api\s*(endpoint|call|request)|rest\s*api|graphql|webhook|http\s*(get|post|put|patch|delete)/i.test(text);
  const hasRateLimiting = /rate\s*limit|throttl|quota|max\s*(request|call)s?\s*(per|\/)\s*(second|minute|hour|day)|429/i.test(text);
  if (mentionsAPI && !hasRateLimiting) {
    findings.push({
      category: 'Missing Rate Limiting Specification',
      description: 'API endpoints are described but rate limiting is not specified.',
      evidence: 'API endpoint references detected without rate limit definitions.',
      severity: 'medium',
      recommendation: 'Define: requests per minute/hour per user/IP, behaviour when rate limit is exceeded (HTTP 429, retry-after header), and any whitelisted clients.',
    });
  }

  return {
    findings,
    totalFound: findings.length,
    missingFieldDefinitions: findings.some(f => f.category.includes('Validation')),
    missingConstraints: findings.some(f => f.category.includes('Constraint') || f.category.includes('Pagination')),
    missingFileTypeDefinitions: findings.some(f => f.category.includes('File Type')),
    missingValidationRules: findings.some(f => f.category.includes('Validation')),
  };
}
