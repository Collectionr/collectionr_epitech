import { ValidationPipe } from '@nestjs/common';

/**
 * Global DTO validation pipe (class-validator / class-transformer).
 * - whitelist + forbidNonWhitelisted: any property not declared on the DTO is rejected (400)
 * - transform: payloads are instantiated as typed DTO classes
 * - enableImplicitConversion disabled: conversions stay explicit (@Type)
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
  });
}
