import type { Redis } from 'ioredis';
import { RedisHealthIndicator } from './RedisHealthIndicator';

describe('RedisHealthIndicator', () => {
  it('reports the cache as up when PING succeeds on an established connection', async () => {
    const redisClient = {
      status: 'ready',
      ping: jest.fn().mockResolvedValue('PONG'),
    } as unknown as Redis;
    const indicator = new RedisHealthIndicator(redisClient);

    const result = await indicator.check();

    expect(result.name).toBe('cache');
    expect(result.state).toBe('up');
    expect(typeof result.latencyMs).toBe('number');
  });

  it('establishes the connection first when the client is lazy', async () => {
    const connect = jest.fn().mockResolvedValue(undefined);
    const redisClient = {
      status: 'wait',
      connect,
      ping: jest.fn().mockResolvedValue('PONG'),
    } as unknown as Redis;
    const indicator = new RedisHealthIndicator(redisClient);

    const result = await indicator.check();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(result.state).toBe('up');
  });

  it('reports the cache as down when the connection fails', async () => {
    const redisClient = {
      status: 'wait',
      connect: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      ping: jest.fn(),
    } as unknown as Redis;
    const indicator = new RedisHealthIndicator(redisClient);

    const result = await indicator.check();

    expect(result.state).toBe('down');
    expect(result.latencyMs).toBeNull();
  });

  it('reports the cache as down when PING fails', async () => {
    const redisClient = {
      status: 'ready',
      ping: jest.fn().mockRejectedValue(new Error('connection lost')),
    } as unknown as Redis;
    const indicator = new RedisHealthIndicator(redisClient);

    const result = await indicator.check();

    expect(result.state).toBe('down');
  });
});
