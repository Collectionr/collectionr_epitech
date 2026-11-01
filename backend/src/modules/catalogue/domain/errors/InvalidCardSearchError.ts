/**
 * A card search was refused because of what the caller asked for (term too short, limit out of
 * range…). It is the caller's mistake, so the interface layer may turn it into a 4xx; anything
 * else that comes out of the catalogue is a bug or an infrastructure failure. The message never
 * echoes the rejected term.
 */
export class InvalidCardSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCardSearchError';
  }
}
