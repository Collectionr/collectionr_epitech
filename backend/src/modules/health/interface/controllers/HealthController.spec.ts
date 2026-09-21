import type { FastifyReply } from 'fastify';
import { HealthController } from './HealthController';
import type { GetHealthStatusUseCase } from '../../application/use-cases/GetHealthStatusUseCase';
import { DependencyHealth, HealthStatus } from '../../domain/entities/HealthStatus';

describe('HealthController', () => {
  const checkedAt = new Date('2026-01-01T00:00:00.000Z');

  function buildController(healthStatus: HealthStatus): HealthController {
    const useCase = {
      execute: jest.fn().mockResolvedValue(healthStatus),
    } as unknown as GetHealthStatusUseCase;
    return new HealthController(useCase);
  }

  function buildReply(): { reply: FastifyReply; status: jest.Mock } {
    const status = jest.fn();
    return { reply: { status } as unknown as FastifyReply, status };
  }

  it('answers 200 with the DTO when everything is up', async () => {
    const controller = buildController(
      HealthStatus.fromDependencies(checkedAt, [new DependencyHealth('database', 'up', 5)]),
    );
    const { reply, status } = buildReply();

    const dto = await controller.check(reply);

    expect(status).toHaveBeenCalledWith(200);
    expect(dto.status).toBe('ok');
  });

  it('answers 503 with the DTO when a dependency is down', async () => {
    const controller = buildController(
      HealthStatus.fromDependencies(checkedAt, [new DependencyHealth('cache', 'down', null)]),
    );
    const { reply, status } = buildReply();

    const dto = await controller.check(reply);

    expect(status).toHaveBeenCalledWith(503);
    expect(dto.status).toBe('degraded');
  });
});
