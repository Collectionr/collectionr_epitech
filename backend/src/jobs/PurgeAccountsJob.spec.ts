import { ANONYMIZATION_BATCH_SIZE } from '../modules/auth/application/use-cases/AnonymizeDueAccountsUseCase';
import {
  JOB_EXIT_FAILURE,
  JOB_EXIT_SUCCESS,
  MAX_BATCHES_PER_RUN,
  runPurgeAccountsJob,
} from './PurgeAccountsJob';

describe('runPurgeAccountsJob', () => {
  const purge = jest.fn();
  const log = jest.fn();
  const error = jest.fn();
  const run = (): Promise<number> => runPurgeAccountsJob(purge, { log, error });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('succeeds and says how many accounts were anonymized', async () => {
    purge.mockResolvedValue({ anonymized: 3, failed: 0 });

    await expect(run()).resolves.toBe(JOB_EXIT_SUCCESS);
    expect(purge).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Account purge finished: anonymized=3 failed=0');
  });

  it('fails as soon as one account could not be anonymized', async () => {
    purge.mockResolvedValue({ anonymized: 2, failed: 1 });

    await expect(run()).resolves.toBe(JOB_EXIT_FAILURE);
    expect(error).toHaveBeenCalledWith('Account purge finished: anonymized=2 failed=1');
  });

  it('takes the next batch when one was full, and adds the totals up', async () => {
    purge
      .mockResolvedValueOnce({ anonymized: ANONYMIZATION_BATCH_SIZE, failed: 0 })
      .mockResolvedValueOnce({ anonymized: 7, failed: 0 });

    await expect(run()).resolves.toBe(JOB_EXIT_SUCCESS);
    expect(purge).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith(
      `Account purge finished: anonymized=${ANONYMIZATION_BATCH_SIZE + 7} failed=0`,
    );
  });

  it('stops when a full batch made no progress', async () => {
    purge.mockResolvedValue({ anonymized: 0, failed: ANONYMIZATION_BATCH_SIZE });

    await expect(run()).resolves.toBe(JOB_EXIT_FAILURE);
    expect(purge).toHaveBeenCalledTimes(1);
  });

  it('never chains more batches than MAX_BATCHES_PER_RUN', async () => {
    purge.mockResolvedValue({ anonymized: ANONYMIZATION_BATCH_SIZE, failed: 0 });

    await run();

    expect(purge).toHaveBeenCalledTimes(MAX_BATCHES_PER_RUN);
  });

  it('fails when the purge cannot run, logging the error name only', async () => {
    purge.mockRejectedValue(new Error('postgres://user:secret@db'));

    await expect(run()).resolves.toBe(JOB_EXIT_FAILURE);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('(Error)'));
    expect(JSON.stringify(error.mock.calls)).not.toContain('secret');
  });

  it('copes with a rejection that is not an Error', async () => {
    purge.mockRejectedValue('boom');

    await expect(run()).resolves.toBe(JOB_EXIT_FAILURE);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('unknown error'));
  });
});
