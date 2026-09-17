import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { PrismaHealthIndicator } from './PrismaHealthIndicator';

describe('PrismaHealthIndicator', () => {
  it('reports the database as up with a latency when SELECT 1 succeeds', async () => {
    const prismaClient = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaClient;
    const indicator = new PrismaHealthIndicator(prismaClient);

    const result = await indicator.check();

    expect(result.name).toBe('database');
    expect(result.state).toBe('up');
    expect(typeof result.latencyMs).toBe('number');
  });

  it('reports the database as down when the query fails', async () => {
    const prismaClient = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    } as unknown as PrismaClient;
    const indicator = new PrismaHealthIndicator(prismaClient);

    const result = await indicator.check();

    expect(result.state).toBe('down');
    expect(result.latencyMs).toBeNull();
  });
});
