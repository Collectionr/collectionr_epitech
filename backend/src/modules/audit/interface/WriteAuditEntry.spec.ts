import { Logger } from '@nestjs/common';
import type { RecordAuditEntryUseCase } from '../application/use-cases/RecordAuditEntryUseCase';
import { writeAuditEntry } from './WriteAuditEntry';

describe('writeAuditEntry', () => {
  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls the use case with the entry built from the request and options', async () => {
    const execute = jest.fn().mockResolvedValue(undefined);

    await writeAuditEntry(
      { recordAuditEntry: { execute } as unknown as RecordAuditEntryUseCase, logger: new Logger() },
      { params: { id: '7d444840-9dc0-41d5-bf4a-0e4c0b5c1e11' } },
      { action: 'probe.update', targetType: 'probe', targetIdParam: 'id' },
      'probe.update',
      { statusCode: 200 },
    );

    expect(execute).toHaveBeenCalledWith({
      userId: null,
      action: 'probe.update',
      targetType: 'probe',
      targetId: '7d444840-9dc0-41d5-bf4a-0e4c0b5c1e11',
      metadata: { statusCode: 200 },
    });
  });

  it('logs and swallows an Error thrown by the use case', async () => {
    const execute = jest.fn().mockRejectedValue(new Error('db down'));

    await writeAuditEntry(
      { recordAuditEntry: { execute } as unknown as RecordAuditEntryUseCase, logger: new Logger() },
      {},
      { action: 'a.b' },
      'a.b',
    );

    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });

  it('logs a generic reason when the use case throws a non-Error value', async () => {
    const execute = jest.fn().mockRejectedValue('boom');

    await writeAuditEntry(
      { recordAuditEntry: { execute } as unknown as RecordAuditEntryUseCase, logger: new Logger() },
      {},
      { action: 'a.b' },
      'a.b',
    );

    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('unknown error'));
  });
});
