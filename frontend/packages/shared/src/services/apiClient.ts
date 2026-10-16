/** Sous-ensemble des options de `fetch` utilisé par le client API. */
export interface FetchRequestInitLike {
  /** Méthode HTTP de la requête */
  method?: string;
  /** En-têtes HTTP de la requête */
  headers?: Record<string, string>;
  /** Corps de la requête, déjà sérialisé */
  body?: string;
}

/** Sous-ensemble de la `Response` de `fetch` lu par le client API. */
export interface FetchResponseLike {
  /** Vrai si le statut HTTP est dans la plage 200-299 */
  readonly ok: boolean;
  /** Statut HTTP de la réponse */
  readonly status: number;
  /** Lit le corps de la réponse et le parse en JSON */
  json(): Promise<unknown>;
}

/**
 * Signature minimale de `fetch` attendue par le client API.
 * Le `fetch` natif du navigateur et celui de React Native y sont assignables.
 */
export type FetchLike = (url: string, init?: FetchRequestInitLike) => Promise<FetchResponseLike>;

/** Chemin d'un endpoint, relatif à l'URL de base (ex. : "/cards"). */
export type ApiPath = `/${string}`;

/** Méthodes HTTP acceptées par le client API. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Options d'une requête envoyée par le client API. */
export interface ApiRequestOptions {
  /** Méthode HTTP, `GET` par défaut */
  method?: HttpMethod;
  /** Corps de la requête, sérialisé en JSON s'il est différent de `undefined` (`null` est envoyé tel quel) */
  body?: unknown;
}

/** Options de création du client API. */
export interface ApiClientOptions {
  /** URL de base de l'API, absolue ou relative (ex. : "/api/v1") */
  baseUrl: string;
  /** Implémentation de `fetch` fournie par l'application */
  fetch: FetchLike;
}

/** Client HTTP minimal vers l'API Collectionr. */
export interface ApiClient {
  /**
   * Envoie une requête à l'API.
   * @param path - Chemin de l'endpoint, commençant par "/"
   * @param options - Méthode et corps de la requête
   * @returns Le corps JSON de la réponse, non validé, ou `undefined` pour une réponse 204
   * @throws {ApiError} Si le statut HTTP n'est pas dans la plage 200-299
   */
  request(path: ApiPath, options?: ApiRequestOptions): Promise<unknown>;
}

/** Erreur levée par le client API quand le statut HTTP de la réponse indique un échec. */
export class ApiError extends Error {
  /** Statut HTTP de la réponse en échec */
  readonly status: number;

  /**
   * @param status - Statut HTTP de la réponse
   * @param message - Description de l'échec
   */
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const HTTP_NO_CONTENT = 204;
const JSON_MEDIA_TYPE = 'application/json';
const TRAILING_SLASHES = /\/+$/;

/**
 * Crée un client HTTP vers l'API. L'URL de chaque requête est la concaténation
 * de `baseUrl` (sans "/" final) et du chemin demandé.
 * @param options - URL de base et implémentation de `fetch`
 * @returns Le client API
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const { fetch: fetchFn } = options;
  const baseUrl = options.baseUrl.replace(TRAILING_SLASHES, '');

  return {
    async request(path, { method = 'GET', body } = {}) {
      const hasBody = body !== undefined;
      // Appel sans receveur : le fetch du navigateur lève « Illegal invocation »
      // s'il est appelé comme méthode d'un autre objet que window.
      const response = await fetchFn(`${baseUrl}${path}`, {
        method,
        headers: hasBody
          ? { Accept: JSON_MEDIA_TYPE, 'Content-Type': JSON_MEDIA_TYPE }
          : { Accept: JSON_MEDIA_TYPE },
        ...(hasBody && { body: JSON.stringify(body) }),
      });

      if (!response.ok) {
        throw new ApiError(
          response.status,
          `Requête ${method} ${path} en échec (HTTP ${response.status})`,
        );
      }

      if (response.status === HTTP_NO_CONTENT) {
        return undefined;
      }

      return response.json();
    },
  };
}
