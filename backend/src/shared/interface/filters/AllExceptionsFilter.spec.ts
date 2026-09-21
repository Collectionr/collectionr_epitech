import {
  BadRequestException,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './AllExceptionsFilter';
import type { StandardErrorResponse } from './AllExceptionsFilter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let sendMock: jest.Mock;
  let statusMock: jest.Mock;
  let host: ArgumentsHost;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    filter = new AllExceptionsFilter();
    sendMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ send: sendMock });

    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({ method: 'GET', url: '/api/v1/cartes' }),
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function capturedBody(): StandardErrorResponse {
    const calls = sendMock.mock.calls as [[StandardErrorResponse]];
    return calls[0][0];
  }

  it('formats an HttpException using the standard error shape', () => {
    filter.catch(new NotFoundException('Carte introuvable'), host);

    expect(statusMock).toHaveBeenCalledWith(404);
    const body = capturedBody();
    expect(body.statusCode).toBe(404);
    expect(body.error).toBe('Not Found');
    expect(body.message).toBe('Carte introuvable');
    expect(body.path).toBe('/api/v1/cartes');
    expect(typeof body.timestamp).toBe('string');
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it('uses the plain string response of a 4xx HttpException as error and message', () => {
    filter.catch(new HttpException('Quota dépassé', 429), host);

    expect(statusMock).toHaveBeenCalledWith(429);
    const body = capturedBody();
    expect(body.error).toBe('Quota dépassé');
    expect(body.message).toBe('Quota dépassé');
  });

  it('keeps the message array produced by the ValidationPipe', () => {
    const validationException = new BadRequestException([
      'name should not be empty',
      'quantity must be an integer number',
    ]);

    filter.catch(validationException, host);

    expect(statusMock).toHaveBeenCalledWith(400);
    const body = capturedBody();
    expect(body.message).toEqual([
      'name should not be empty',
      'quantity must be an integer number',
    ]);
    expect(body.error).toBe('Bad Request');
  });

  it('hides internal details for unexpected errors and returns a generic 500', () => {
    filter.catch(new Error('mot de passe BDD invalide'), host);

    expect(statusMock).toHaveBeenCalledWith(500);
    const body = capturedBody();
    expect(body.statusCode).toBe(500);
    expect(body.error).toBe('Internal Server Error');
    expect(JSON.stringify(body)).not.toContain('mot de passe');
  });

  it('masks the message and error label of an HttpException with a 5xx status', () => {
    filter.catch(new ServiceUnavailableException('connexion pg refusée pour collectionr'), host);

    expect(statusMock).toHaveBeenCalledWith(503);
    const body = capturedBody();
    expect(body.statusCode).toBe(503);
    expect(body.error).toBe('Service Unavailable');
    expect(body.message).toBe('Une erreur interne est survenue');
    expect(JSON.stringify(body)).not.toContain('collectionr');
  });

  it('masks the plain string response of an HttpException with a 5xx status', () => {
    filter.catch(new HttpException('token interne 12345', 502), host);

    expect(statusMock).toHaveBeenCalledWith(502);
    const body = capturedBody();
    expect(body.error).toBe('Bad Gateway');
    expect(body.message).toBe('Une erreur interne est survenue');
    expect(JSON.stringify(body)).not.toContain('12345');
  });

  it('keeps the real detail and the stack in the server logs for 5xx errors', () => {
    filter.catch(new ServiceUnavailableException('connexion pg refusée'), host);

    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('connexion pg refusée'),
      expect.any(String),
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('GET /api/v1/cartes'),
      expect.any(String),
    );
  });

  it('handles non-Error thrown values without crashing', () => {
    filter.catch('boom', host);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(capturedBody().statusCode).toBe(500);
  });
});
