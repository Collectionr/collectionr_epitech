import type { DependencyHealth } from '../../domain/entities/HealthStatus';

export const HEALTH_INDICATORS = 'HEALTH_INDICATORS';

/**
 * Port applicatif : un indicateur vérifie la disponibilité effective d'une
 * dépendance d'infrastructure (PostgreSQL, Redis, ...). Un indicateur ne
 * lève jamais : il renvoie un état down en cas d'échec ou de timeout.
 */
export interface IHealthIndicator {
  check(): Promise<DependencyHealth>;
}
