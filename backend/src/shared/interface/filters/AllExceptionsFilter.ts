import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Format d'erreur standardisé renvoyé par toute l'API, quel que soit le domaine.
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
 * Filtre d'exception global : convertit toute exception (HttpException ou
 * erreur inattendue) vers le format StandardErrorResponse. Les erreurs 5xx
 * sont loguées avec leur stack mais renvoient un message générique afin de
 * ne jamais exposer de détail interne au client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const reply = httpContext.getResponse<FastifyReply>();
    const request = httpContext.getRequest<FastifyRequest>();

    const { statusCode, error, message } = this.resolveError(exception);

    if (statusCode >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`Exception non gérée sur ${request.method} ${request.url}`, stack);
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
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
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

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Une erreur interne est survenue',
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
