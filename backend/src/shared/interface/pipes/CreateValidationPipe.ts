import { ValidationPipe } from '@nestjs/common';

/**
 * Pipe de validation global des DTO (class-validator / class-transformer).
 * - whitelist + forbidNonWhitelisted : toute propriété non déclarée dans le DTO est rejetée (400)
 * - transform : les payloads sont instanciés en classes DTO typées
 * - enableImplicitConversion désactivé : les conversions restent explicites (@Type)
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
  });
}
