import { HealthResponseDto } from './HealthResponseDto';
import { DependencyHealth, HealthStatus } from '../../domain/entities/HealthStatus';

describe('HealthResponseDto', () => {
  it('maps the domain aggregate to the API response shape', () => {
    const checkedAt = new Date('2026-01-01T00:00:00.000Z');
    const healthStatus = HealthStatus.fromDependencies(checkedAt, [
      new DependencyHealth('database', 'up', 12),
      new DependencyHealth('cache', 'down', null),
    ]);

    const dto = HealthResponseDto.fromDomain(healthStatus);

    expect(dto.status).toBe('degraded');
    expect(dto.checkedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(dto.dependencies).toEqual([
      { name: 'database', status: 'up', latencyMs: 12 },
      { name: 'cache', status: 'down', latencyMs: null },
    ]);
  });
});
