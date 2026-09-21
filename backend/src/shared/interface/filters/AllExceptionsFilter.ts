import { STATUS_CODES } from 'node:http';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

const INTERNAL_ERROR_MESSAGE = 'Une erreur interne est survenue';
const FIRST_SERVER_ERROR_STATUS = 500;

/**
 * Standardized error format returned by the whole API, regardless of domain.
 */
export interface StandardErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

interface ResolvedError {
  statusCode: number;
  error: string;
  message: string | string[];
}

/**
 * Global exception filter: converts any exception (HttpException or
 * unexpected error) into the StandardErrorResponse format. Every 5xx
 * error, whether it comes from an HttpException or not, is logged with
 * its real message and stack but returns a generic body (standard HTTP
 * reason phrase + generic message) so no internal detail is ever exposed
 * to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const reply = httpContext.getResponse<FastifyReply>();
    const request = httpContext.getRequest<FastifyRequest>();

    const { statusCode, error, message } = this.resolveError(exception);

    if (statusCode >= FIRST_SERVER_ERROR_STATUS) {
      // An HttpException stack does not include its message, so the real detail
      // is logged explicitly: it must stay available server-side for debugging.
      const detail = exception instanceof Error ? exception.message : String(exception);
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `Exception non gérée sur ${request.method} ${request.url} : ${detail}`,
        stack,
      );
    }

    const body: StandardErrorResponse = {
      statusCode,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    void reply.status(statusCode).send(body);
  }

  private resolveError(exception: unknown): ResolvedError {
    if (!(exception instanceof HttpException)) {
      return this.genericServerError(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const statusCode = exception.getStatus();

    // Server-side failures never expose the exception's own message or error label.
    if (statusCode >= FIRST_SERVER_ERROR_STATUS) {
      return this.genericServerError(statusCode);
    }

    const response = exception.getResponse();

    if (typeof response === 'string') {
      return { statusCode, error: response, message: response };
    }

    const responseObject = response as Record<string, unknown>;
    const message = this.extractMessage(responseObject) ?? exception.message;
    const error =
      typeof responseObject.error === 'string' ? responseObject.error : exception.message;

    return { statusCode, error, message };
  }

  private genericServerError(statusCode: number): ResolvedError {
    return {
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Internal Server Error',
      message: INTERNAL_ERROR_MESSAGE,
    };
  }

  private extractMessage(response: Record<string, unknown>): string | string[] | undefined {
    const { message } = response;

    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
      return message;
    }

    return undefined;
  }
}
