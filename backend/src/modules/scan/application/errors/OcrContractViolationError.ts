/**
 * The backend was asked to send a message that breaks the contract. A bug of the caller, not
 * something a client can cause: it stays a generic 5xx. Messages name the offending fields and
 * never echo their values.
 */
export class OcrContractViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OcrContractViolationError';
  }
}
