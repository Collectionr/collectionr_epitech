/**
 * A business rule rejected a value (job id, image format...). Local copy, like in the other
 * modules: modules do not import each other's domain. Messages never echo the rejected value.
 */
export class DomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainValidationError';
  }
}
