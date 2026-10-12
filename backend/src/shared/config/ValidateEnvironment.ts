import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { ValidationError } from 'class-validator';
import { EnvironmentVariables } from './EnvironmentVariables';
import { weakSecretReason } from './JwtSecretPolicy';
import { parseTrustedProxies } from './TrustedProxies';

function formatValidationError(error: ValidationError): string {
  const constraints = Object.values(error.constraints ?? {}).join(', ');
  return `  - ${error.property}: ${constraints}`;
}

// Rules that span several variables, or that class-validator decorators cannot express. Only run on
// values that already passed the per-field checks, so a missing variable is reported once.
function crossFieldProblems(environment: EnvironmentVariables): string[] {
  const problems: string[] = [];

  const weakness = weakSecretReason(environment.JWT_SECRET);
  if (weakness !== null) {
    problems.push(`  - JWT_SECRET: ${weakness}`);
  }

  if (environment.JWT_ACCESS_TOKEN_TTL_SECONDS >= environment.JWT_REFRESH_TOKEN_TTL_SECONDS) {
    problems.push(
      '  - JWT_ACCESS_TOKEN_TTL_SECONDS: must be shorter than JWT_REFRESH_TOKEN_TTL_SECONDS',
    );
  }
  if (environment.JWT_REFRESH_TOKEN_TTL_SECONDS > environment.JWT_SESSION_MAX_LIFETIME_SECONDS) {
    problems.push(
      '  - JWT_SESSION_MAX_LIFETIME_SECONDS: must be at least JWT_REFRESH_TOKEN_TTL_SECONDS',
    );
  }

  try {
    parseTrustedProxies(environment.TRUSTED_PROXIES);
  } catch (error) {
    problems.push(`  - TRUSTED_PROXIES: ${error instanceof Error ? error.message : String(error)}`);
  }

  return problems;
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const environment = plainToInstance(EnvironmentVariables, config, {
    exposeDefaultValues: true,
  });

  const errors = validateSync(environment, {
    skipMissingProperties: false,
    forbidUnknownValues: false,
  });

  const details = errors.map(formatValidationError);
  if (errors.length === 0) {
    details.push(...crossFieldProblems(environment));
  }

  if (details.length > 0) {
    throw new Error(`Invalid environment variables, startup refused:\n${details.join('\n')}`);
  }

  return environment;
}
