import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './AllExceptionsFilter';
import type { StandardErrorResponse } from './AllExceptionsFilter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let sendMock: jest.Mock;
  let statusMock: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
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

  it('handles non-Error thrown values without crashing', () => {
    filter.catch('boom', host);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(capturedBody().statusCode).toBe(500);
  });
});
