/**
 * Field names that must never end up in an audit entry (S05 §6: no passwords,
 * no authentication tokens, minimised personal data).
 */
const SENSITIVE_FIELD_PATTERN =
  /pass(word|wd)?|token|secret|authorization|cookie|hash|jwt|otp|api[_-]?key|\bpin\b|cvv|ssn|iban/i;

export function isSensitiveFieldName(fieldName: string): boolean {
  return SENSITIVE_FIELD_PATTERN.test(fieldName);
}
