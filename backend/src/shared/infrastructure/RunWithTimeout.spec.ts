import { runWithTimeout } from './RunWithTimeout';

describe('runWithTimeout', () => {
  it('resolves with the promise value when it settles before the timeout', async () => {
    await expect(runWithTimeout(Promise.resolve('ok'), 1000, 'Test')).resolves.toBe('ok');
  });

  it('propagates the promise rejection', async () => {
    await expect(runWithTimeout(Promise.reject(new Error('boom')), 1000, 'Test')).rejects.toThrow(
      'boom',
    );
  });

  it('rejects with an explicit message when the timeout is reached', async () => {
    const neverSettles = new Promise<never>(() => undefined);

    await expect(runWithTimeout(neverSettles, 10, 'PostgreSQL')).rejects.toThrow(
      'PostgreSQL: timed out after 10 ms',
    );
  });
});
