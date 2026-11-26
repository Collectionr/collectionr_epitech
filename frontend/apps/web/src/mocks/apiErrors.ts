import { HttpResponse } from 'msw';

/** Libellé `error` du back pour chaque statut renvoyé par les handlers simulés. */
const STATUS_LABELS: Record<number, string> = {
  400: 'Bad Request',
  404: 'Not Found',
};

/**
 * Réponse d'erreur au format unique du back (`AllExceptionsFilter`) :
 * `{ statusCode, error, message, timestamp, path }`.
 * @param request - Requête refusée
 * @param status - Statut HTTP
 * @param message - Message du back, en anglais comme lui
 */
export function apiError(request: Request, status: number, message: string): Response {
  return HttpResponse.json(
    {
      statusCode: status,
      error: STATUS_LABELS[status] ?? `HTTP ${status}`,
      message,
      timestamp: new Date().toISOString(),
      path: new URL(request.url).pathname,
    },
    { status },
  );
}
