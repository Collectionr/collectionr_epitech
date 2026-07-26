import type { Pool } from 'pg';
import { PostgresHealthIndicator } from './PostgresHealthIndicator';

describe('PostgresHealthIndicator', () => {
  it('reports the database as up with a latency when SELECT 1 succeeds', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) } as unknown as Pool;
    const indicator = new PostgresHealthIndicator(pool);

    const result = await indicator.check();

    expect(result.name).toBe('database');
    expect(result.state).toBe('up');
    expect(typeof result.latencyMs).toBe('number');
  });

  it('reports the database as down when the query fails', async () => {
    const pool = {
      query: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    } as unknown as Pool;
    const indicator = new PostgresHealthIndicator(pool);

    const result = await indicator.check();

    expect(result.state).toBe('down');
    expect(result.latencyMs).toBeNull();
  });
});
