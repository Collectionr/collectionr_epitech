import { GetHealthStatusUseCase } from './GetHealthStatusUseCase';
import { DependencyHealth } from '../../domain/entities/HealthStatus';
import type { IClockService } from '../ports/IClockService';
import type { IHealthIndicator } from '../ports/IHealthIndicator';

describe('GetHealthStatusUseCase', () => {
  const fixedDate = new Date('2026-01-01T00:00:00.000Z');
  const mockClockService: IClockService = { now: jest.fn().mockReturnValue(fixedDate) };

  function buildIndicator(dependency: DependencyHealth): IHealthIndicator {
    return { check: jest.fn().mockResolvedValue(dependency) };
  }

  it('returns an ok status when every dependency is up', async () => {
    const useCase = new GetHealthStatusUseCase(mockClockService, [
      buildIndicator(new DependencyHealth('database', 'up', 12)),
      buildIndicator(new DependencyHealth('cache', 'up', 3)),
    ]);

    const result = await useCase.execute();

    expect(result.state).toBe('ok');
    expect(result.checkedAt).toBe(fixedDate);
    expect(result.dependencies).toHaveLength(2);
    expect(result.isHealthy()).toBe(true);
  });

  it('returns a degraded status when a dependency is down', async () => {
    const useCase = new GetHealthStatusUseCase(mockClockService, [
      buildIndicator(new DependencyHealth('database', 'up', 12)),
      buildIndicator(new DependencyHealth('cache', 'down', null)),
    ]);

    const result = await useCase.execute();

    expect(result.state).toBe('degraded');
    expect(result.isHealthy()).toBe(false);
    expect(result.dependencies.find((d) => d.name === 'cache')?.state).toBe('down');
  });

  it('checks every registered indicator', async () => {
    const databaseCheck = jest.fn().mockResolvedValue(new DependencyHealth('database', 'up', 1));
    const cacheCheck = jest.fn().mockResolvedValue(new DependencyHealth('cache', 'up', 1));
    const useCase = new GetHealthStatusUseCase(mockClockService, [
      { check: databaseCheck },
      { check: cacheCheck },
    ]);

    await useCase.execute();

    expect(databaseCheck).toHaveBeenCalledTimes(1);
    expect(cacheCheck).toHaveBeenCalledTimes(1);
  });
});
