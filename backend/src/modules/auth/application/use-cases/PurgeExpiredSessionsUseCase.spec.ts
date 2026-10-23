import { PurgeExpiredSessionsUseCase } from './PurgeExpiredSessionsUseCase';
import type { ISessionPurger } from '../ports/ISessionPurger';

describe('PurgeExpiredSessionsUseCase', () => {
  it('purges the sessions expired at the current instant and returns how many', async () => {
    const purgeExpiredSessions = jest.fn().mockResolvedValue(42);
    const purger: ISessionPurger = { purgeExpiredSessions };

    const before = Date.now();
    const count = await new PurgeExpiredSessionsUseCase(purger).execute();

    expect(count).toBe(42);
    const [cutoff] = purgeExpiredSessions.mock.calls[0] as [Date];
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before);
    expect(cutoff.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
