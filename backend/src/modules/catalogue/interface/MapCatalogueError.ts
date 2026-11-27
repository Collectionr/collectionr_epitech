import { BadRequestException } from '@nestjs/common';
import { InvalidCardSearchError } from '../domain/errors/InvalidCardSearchError';

/** Converts validated catalogue-domain search errors into a standard HTTP 400 response. */
export function mapCatalogueError(error: unknown): void {
  if (error instanceof InvalidCardSearchError) {
    throw new BadRequestException(error.message);
  }
}
