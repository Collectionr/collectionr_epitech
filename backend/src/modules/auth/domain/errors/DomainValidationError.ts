/**
 * A business rule rejected a user-supplied value (email, password, username...).
 * The only domain error that is safe to turn into a 4xx: anything else that
 * reaches the interface layer is a bug or an infrastructure failure and must
 * stay a generic 5xx. Messages never echo the rejected value.
 */
export class DomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainValidationError';
  }
}
