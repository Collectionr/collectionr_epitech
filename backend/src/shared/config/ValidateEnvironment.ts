import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { ValidationError } from 'class-validator';
import { EnvironmentVariables } from './EnvironmentVariables';

function formatValidationError(error: ValidationError): string {
  const constraints = Object.values(error.constraints ?? {}).join(', ');
  return `  - ${error.property}: ${constraints}`;
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const environment = plainToInstance(EnvironmentVariables, config, {
    exposeDefaultValues: true,
  });

  const errors = validateSync(environment, {
    skipMissingProperties: false,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    const details = errors.map(formatValidationError).join('\n');
    throw new Error(`Variables d'environnement invalides, démarrage refusé :\n${details}`);
  }

  return environment;
}
