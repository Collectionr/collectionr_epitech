import type { DependencyHealth } from '../../domain/entities/HealthStatus';

export const HEALTH_INDICATORS = 'HEALTH_INDICATORS';

/**
 * Application port: an indicator checks the actual availability of an
 * infrastructure dependency (PostgreSQL, Redis, ...). An indicator never
 * throws: it returns a down state on failure or timeout.
 */
export interface IHealthIndicator {
  check(): Promise<DependencyHealth>;
}
