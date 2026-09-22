import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { RecordAuditEntryUseCase } from '../../../modules/audit/application/use-cases/RecordAuditEntryUseCase';
import { AllExceptionsFilter } from './AllExceptionsFilter';
import type { StandardErrorResponse } from './AllExceptionsFilter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let sendMock: jest.Mock;
  let statusMock: jest.Mock;
  let recordAuditEntry: jest.Mock;
  let host: ArgumentsHost;
  let loggerErrorSpy: jest.SpyInstance;

  function buildHost(request: Record<string, unknown>): ArgumentsHost {
    // A single, stable request object: Fastify returns the same instance for
    // the whole lifecycle of one request, which matters here since consuming
    // the stashed @Audit context mutates it.
    const requestObject = { method: 'GET', url: '/api/v1/cards', ...request };
    return {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => requestObject,
      }),
    } as unknown as ArgumentsHost;
  }

  beforeEach(() => {
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    recordAuditEntry = jest.fn().mockResolvedValue(undefined);
    filter = new AllExceptionsFilter({
      execute: recordAuditEntry,
    } as unknown as RecordAuditEntryUseCase);
    sendMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ send: sendMock });
    host = buildHost({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function capturedBody(): StandardErrorResponse {
    const calls = sendMock.mock.calls as [[StandardErrorResponse]];
    return calls[0][0];
  }

  it('formats an HttpException using the standard error shape', async () => {
    await filter.catch(new NotFoundException('Card not found'), host);

    expect(statusMock).toHaveBeenCalledWith(404);
    const body = capturedBody();
    expect(body.statusCode).toBe(404);
    expect(body.error).toBe('Not Found');
    expect(body.message).toBe('Card not found');
    expect(body.path).toBe('/api/v1/cards');
    expect(typeof body.timestamp).toBe('string');
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it('uses the plain string response of a 4xx HttpException as error and message', async () => {
    await filter.catch(new HttpException('Quota exceeded', 429), host);

    expect(statusMock).toHaveBeenCalledWith(429);
    const body = capturedBody();
    expect(body.error).toBe('Quota exceeded');
    expect(body.message).toBe('Quota exceeded');
  });

  it('keeps the message array produced by the ValidationPipe', async () => {
    const validationException = new BadRequestException([
      'name should not be empty',
      'quantity must be an integer number',
    ]);

    await filter.catch(validationException, host);

    expect(statusMock).toHaveBeenCalledWith(400);
    const body = capturedBody();
    expect(body.message).toEqual([
      'name should not be empty',
      'quantity must be an integer number',
    ]);
    expect(body.error).toBe('Bad Request');
  });

  it('hides internal details for unexpected errors and returns a generic 500', async () => {
    await filter.catch(new Error('internal secret detail'), host);

    expect(statusMock).toHaveBeenCalledWith(500);
    const body = capturedBody();
    expect(body.statusCode).toBe(500);
    expect(body.error).toBe('Internal Server Error');
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('masks the message and error label of an HttpException with a 5xx status', async () => {
    await filter.catch(new ServiceUnavailableException('internal secret detail'), host);

    expect(statusMock).toHaveBeenCalledWith(503);
    const body = capturedBody();
    expect(body.statusCode).toBe(503);
    expect(body.error).toBe('Service Unavailable');
    expect(body.message).toBe('An internal error occurred');
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('masks the plain string response of an HttpException with a 5xx status', async () => {
    await filter.catch(new HttpException('internal secret token 12345', 502), host);

    expect(statusMock).toHaveBeenCalledWith(502);
    const body = capturedBody();
    expect(body.error).toBe('Bad Gateway');
    expect(body.message).toBe('An internal error occurred');
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('keeps the real detail and the stack in the server logs for 5xx errors', async () => {
    await filter.catch(new ServiceUnavailableException('internal secret detail'), host);

    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('internal secret detail'),
      expect.any(String),
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('GET /api/v1/cards'),
      expect.any(String),
    );
  });

  it('handles non-Error thrown values without crashing', async () => {
    await filter.catch('boom', host);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(capturedBody().statusCode).toBe(500);
  });

  it('falls back to a generic label for a 5xx status Node does not know a reason phrase for', async () => {
    await filter.catch(new HttpException('detail', 599), host);

    expect(statusMock).toHaveBeenCalledWith(599);
    expect(capturedBody().error).toBe('Internal Server Error');
  });

  it('falls back to the exception message when the response object carries no message field', async () => {
    await filter.catch(new HttpException({ error: 'Teapot' }, 418), host);

    expect(statusMock).toHaveBeenCalledWith(418);
    const body = capturedBody();
    expect(body.error).toBe('Teapot');
    expect(typeof body.message).toBe('string');
  });

  it('does not touch the audit trail for a request without a stashed @Audit context', async () => {
    await filter.catch(new NotFoundException(), host);

    expect(recordAuditEntry).not.toHaveBeenCalled();
  });

  describe('when a guard rejected an @Audit route (AuditContextGuard stashed the context)', () => {
    beforeEach(() => {
      host = buildHost({
        auditContext: { action: 'probe.restricted', targetType: 'probe' },
        params: {},
        body: {},
      });
    });

    it('records a .failed entry with the resolved status code, without changing the response contract', async () => {
      await filter.catch(new ForbiddenException('insufficient role'), host);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(capturedBody()).toMatchObject({ statusCode: 403, message: 'insufficient role' });
      expect(recordAuditEntry).toHaveBeenCalledTimes(1);
      expect(recordAuditEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'probe.restricted.failed',
          targetType: 'probe',
          metadata: { statusCode: 403 },
        }),
      );
    });

    it('consumes the stashed context exactly once', async () => {
      await filter.catch(new ForbiddenException(), host);
      // A second, unrelated exception on a request whose context was already
      // consumed by the first catch() call must not record again.
      await filter.catch(new NotFoundException(), host);

      expect(recordAuditEntry).toHaveBeenCalledTimes(1);
    });

    it('logs a failed audit write without breaking the standard error response', async () => {
      recordAuditEntry.mockRejectedValue(new Error('db down'));

      await filter.catch(new ForbiddenException('insufficient role'), host);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(capturedBody()).toMatchObject({ statusCode: 403 });
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('db down'));
    });
  });
});
