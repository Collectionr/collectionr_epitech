import { runtimeTimers } from '../utils/runtimeTimers';

/**
 * Sous-ensemble des options de `fetch` utilisé par le client API.
 * @typeParam TSignal - Type du signal d'annulation, celui du contrôleur fourni par l'application
 */
export interface FetchRequestInitLike<TSignal> {
  /** Méthode HTTP de la requête */
  method?: string;
  /** En-têtes HTTP de la requête */
  headers?: Record<string, string>;
  /** Corps de la requête, déjà sérialisé */
  body?: string;
  /** Signal d'annulation, déclenché quand le délai maximal est dépassé */
  signal?: TSignal;
}

/** Sous-ensemble des en-têtes de la `Response` de `fetch` lus par le client API. */
export interface FetchHeadersLike {
  /** Valeur de l'en-tête, `null` s'il est absent */
  get(name: string): string | null;
}

/** Sous-ensemble de la `Response` de `fetch` lu par le client API. */
export interface FetchResponseLike {
  /** Vrai si le statut HTTP est dans la plage 200-299 */
  readonly ok: boolean;
  /** Statut HTTP de la réponse */
  readonly status: number;
  /** En-têtes de la réponse */
  readonly headers: FetchHeadersLike;
  /** Lit le corps de la réponse et le parse en JSON */
  json(): Promise<unknown>;
}

/**
 * Signature minimale de `fetch` attendue par le client API.
 * Le `fetch` natif du navigateur et celui de React Native y sont assignables.
 * @typeParam TSignal - Type du signal d'annulation accepté par ce `fetch`
 */
export type FetchLike<TSignal> = (
  url: string,
  init?: FetchRequestInitLike<TSignal>,
) => Promise<FetchResponseLike>;

/**
 * Contrôleur d'annulation fourni par l'application (`new AbortController()` sur web et mobile).
 * Il est injecté, comme `fetch`, parce que `packages/shared` compile sans les types DOM.
 */
export interface AbortControllerLike<TSignal> {
  /** Signal transmis à `fetch` */
  readonly signal: TSignal;
  /** Annule la requête qui porte ce signal */
  abort(): void;
}

/** Chemin d'un endpoint, relatif à l'URL de base (ex. : "/cards"). */
export type ApiPath = `/${string}`;

/** Méthodes HTTP acceptées par le client API. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Signal d'annulation fourni par l'appelant (celui de TanStack Query, `AbortSignal` sur web et
 * mobile) : seul le sous-ensemble lu par le client est typé, `packages/shared` compilant sans DOM.
 */
export interface AbortSignalLike {
  /** Vrai si l'annulation est déjà demandée */
  readonly aborted: boolean;
  /** Abonne une fonction à l'annulation */
  addEventListener(type: 'abort', listener: () => void): void;
  /** Désabonne une fonction de l'annulation */
  removeEventListener(type: 'abort', listener: () => void): void;
}

/** Options d'une requête envoyée par le client API. */
export interface ApiRequestOptions {
  /** Méthode HTTP, `GET` par défaut */
  method?: HttpMethod;
  /** Corps de la requête, sérialisé en JSON s'il est différent de `undefined` (`null` est envoyé tel quel) */
  body?: unknown;
  /**
   * Annule la requête quand il est déclenché (recherche devenue obsolète) : `fetch` est interrompu
   * et la requête lève une `RequestAbortedError`.
   */
  signal?: AbortSignalLike;
}

/**
 * Session utilisée par le client API pour authentifier les requêtes. Le jeton d'accès reste en
 * mémoire : le client le lit à chaque requête et ne le stocke jamais.
 */
export interface ApiSession {
  /** Jeton d'accès courant, ou `null` hors session */
  getAccessToken(): string | null;
  /**
   * Renouvelle la session après un 401. Le client ne l'appelle qu'une fois pour des 401 simultanés.
   * @returns `true` si un nouveau jeton d'accès est disponible, `false` si le renouvellement est refusé
   * @throws {NetworkError} Si le serveur est injoignable : la session est alors conservée
   */
  refresh(): Promise<boolean>;
  /** Vide la session ; appelé par le client quand le renouvellement est refusé. */
  clear(): void;
}

/** Délai maximal par défaut d'une requête, réponse et lecture du corps comprises. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Options de création du client API.
 * @typeParam TSignal - Type du signal d'annulation partagé par `fetch` et `createAbortController`
 */
export interface ApiClientOptions<TSignal> {
  /** URL de base de l'API, absolue ou relative (ex. : "/api/v1") */
  baseUrl: string;
  /** Implémentation de `fetch` fournie par l'application */
  fetch: FetchLike<TSignal>;
  /** Crée un contrôleur d'annulation par requête, utilisé pour le délai maximal */
  createAbortController: () => AbortControllerLike<TSignal>;
  /** Délai maximal d'une requête en millisecondes, `DEFAULT_REQUEST_TIMEOUT_MS` par défaut */
  timeoutMs?: number;
  /** Session à utiliser ; sans session, aucune requête n'est authentifiée */
  session?: ApiSession;
}

/** Client HTTP vers l'API Collectionr. */
export interface ApiClient {
  /**
   * Envoie une requête à l'API, avec le jeton d'accès de la session s'il existe. Sur un 401 d'une
   * requête authentifiée, la session est renouvelée une fois puis la requête est rejouée.
   * @param path - Chemin de l'endpoint, commençant par "/"
   * @param options - Méthode et corps de la requête
   * @returns Le corps JSON de la réponse, non validé, ou `undefined` pour une réponse 204
   * @throws {ApiError} Si le statut HTTP n'est pas dans la plage 200-299
   * @throws {ApiError} Si le corps d'une réponse 2xx (hors 204) n'est pas du JSON valide
   * @throws {NetworkError} Si le serveur est injoignable ou ne répond pas dans le délai maximal
   */
  request(path: ApiPath, options?: ApiRequestOptions): Promise<unknown>;
}

/** Données d'une `ApiError`. */
export interface ApiErrorInit {
  /** Statut HTTP de la réponse */
  status: number;
  /** Code de l'erreur : libellé `error` du back, ou code calculé par le client à défaut */
  code: string;
  /** Description de l'échec */
  message: string;
  /** Erreurs par champ ; le back n'en envoie pas encore, le champ reste vide */
  fieldErrors?: Readonly<Record<string, string>>;
  /** Délai d'attente en secondes avant une nouvelle tentative, lu dans l'en-tête `Retry-After` */
  retryAfterSeconds?: number;
  /** Corps JSON de la réponse, non validé */
  body?: unknown;
}

/** Code d'une `ApiError` levée sur un corps 2xx qui n'est pas du JSON valide. */
export const INVALID_JSON_ERROR_CODE = 'INVALID_JSON';

/**
 * Erreur levée par le client API quand la réponse arrive mais ne peut pas être exploitée :
 * son statut HTTP est hors de la plage 200-299, ou le corps d'une réponse 2xx n'est pas
 * du JSON valide.
 */
export class ApiError extends Error {
  /** Statut HTTP de la réponse en échec */
  readonly status: number;
  /** Code de l'erreur (ex. : "Conflict", "Unauthorized", ou `HTTP_<statut>` sans corps exploitable) */
  readonly code: string;
  /** Erreurs par champ ; le back n'en envoie pas encore, le champ reste vide */
  readonly fieldErrors?: Readonly<Record<string, string>>;
  /** Délai d'attente en secondes avant une nouvelle tentative, s'il est indiqué (429) */
  readonly retryAfterSeconds?: number;
  /** Corps JSON de la réponse en échec, non validé, `undefined` s'il est absent ou illisible */
  readonly body: unknown;

  /** @param init - Statut, code, message et détails de l'échec */
  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.fieldErrors = init.fieldErrors;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.body = init.body;
  }
}

/** Cause d'une `NetworkError` : serveur injoignable, ou réponse trop lente. */
export type NetworkErrorReason = 'connection' | 'timeout';

/**
 * Erreur levée quand aucune réponse exploitable n'arrive : serveur injoignable, coupure pendant
 * la lecture du corps, ou délai maximal dépassé. Distincte d'`ApiError`, qui porte un statut HTTP.
 */
export class NetworkError extends Error {
  /** Cause de l'échec */
  readonly reason: NetworkErrorReason;

  /**
   * @param reason - Cause de l'échec
   * @param message - Description de l'échec
   * @param options - Erreur d'origine, conservée dans `cause`
   */
  constructor(reason: NetworkErrorReason, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'NetworkError';
    this.reason = reason;
  }
}

/**
 * Erreur levée quand l'appelant annule la requête par son signal (recherche devenue obsolète).
 * Ce n'est pas un échec : TanStack Query ignore une requête qu'il a lui-même annulée.
 */
export class RequestAbortedError extends Error {
  /**
   * @param method - Méthode de la requête annulée
   * @param path - Chemin de la requête annulée
   */
  constructor(method: HttpMethod, path: ApiPath) {
    super(`Requête ${method} ${path} annulée`);
    this.name = 'RequestAbortedError';
  }
}

const HTTP_NO_CONTENT = 204;
const HTTP_UNAUTHORIZED = 401;
const JSON_MEDIA_TYPE = 'application/json';
const TRAILING_SLASHES = /\/+$/;
const RETRY_AFTER_SECONDS = /^\d+$/;
/**
 * Les routes `/auth/*` ne déclenchent jamais de renouvellement : un 401 de `/auth/login` signale
 * des identifiants invalides, et un 401 de `/auth/refresh` ne peut pas être réparé par lui-même.
 */
const AUTH_PATH_PREFIX = '/auth/';

/** Réponse reçue, corps lu, avant interprétation par `request`. */
type ReceivedResponse =
  | { readonly ok: true; readonly body: unknown }
  | {
      readonly ok: false;
      readonly status: number;
      readonly headers: FetchHeadersLike;
      readonly body: unknown;
    };

/**
 * Lit le corps JSON d'une réponse réussie.
 * @throws {ApiError} Si le corps n'est pas du JSON valide
 * @throws {NetworkError} Si la lecture échoue pour une autre raison (coupure réseau)
 */
async function readJsonBody(
  response: FetchResponseLike,
  method: HttpMethod,
  path: ApiPath,
): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw new NetworkError('connection', `Réponse ${method} ${path} interrompue`, {
        cause: error,
      });
    }
    throw new ApiError({
      status: response.status,
      code: INVALID_JSON_ERROR_CODE,
      message: `Réponse ${method} ${path} illisible : JSON attendu (HTTP ${response.status})`,
    });
  }
}

/**
 * Lit le corps JSON d'une réponse en échec, sans l'interpréter. Pour une réponse en échec,
 * l'information principale est le statut HTTP et le corps n'est qu'un complément : si sa
 * lecture échoue (corps vide, non JSON, coupure réseau), l'`ApiError` est quand même levée
 * avec le statut plutôt que de le perdre. C'est volontairement différent de `readJsonBody`,
 * où le corps est le résultat attendu.
 * @returns Le corps JSON non validé, ou `undefined` si sa lecture échoue, quelle que soit l'erreur
 */
async function readErrorBody(response: FetchResponseLike): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** Lit un champ d'un corps d'erreur non validé, sans en supposer le type. */
function readField(body: unknown, field: string): unknown {
  return typeof body === 'object' && body !== null ? Reflect.get(body, field) : undefined;
}

/**
 * Message d'un corps d'erreur au format du back (`{ statusCode, error, message, timestamp, path }`) :
 * `message` est un texte, ou une liste de textes pour une validation refusée.
 */
function readErrorMessage(body: unknown): string | undefined {
  const message = readField(body, 'message');
  if (typeof message === 'string') {
    return message;
  }
  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message.join(' ; ');
  }
  return undefined;
}

/** Délai `Retry-After` en secondes ; la forme date HTTP, que le back n'envoie pas, est ignorée. */
function parseRetryAfter(value: string | null): number | undefined {
  return value !== null && RETRY_AFTER_SECONDS.test(value.trim()) ? Number(value) : undefined;
}

function toApiError(
  response: Extract<ReceivedResponse, { ok: false }>,
  method: HttpMethod,
  path: ApiPath,
): ApiError {
  const code = readField(response.body, 'error');
  return new ApiError({
    status: response.status,
    code: typeof code === 'string' ? code : `HTTP_${response.status}`,
    message:
      readErrorMessage(response.body) ??
      `Requête ${method} ${path} en échec (HTTP ${response.status})`,
    retryAfterSeconds: parseRetryAfter(response.headers.get('Retry-After')),
    body: response.body,
  });
}

/**
 * Crée un client HTTP vers l'API. L'URL de chaque requête est la concaténation
 * de `baseUrl` (sans "/" final) et du chemin demandé.
 * @param options - URL de base, `fetch`, contrôleur d'annulation, délai maximal et session
 * @returns Le client API
 */
export function createApiClient<TSignal>(options: ApiClientOptions<TSignal>): ApiClient {
  const {
    fetch: fetchFn,
    createAbortController,
    session,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  } = options;
  const baseUrl = options.baseUrl.replace(TRAILING_SLASHES, '');
  let pendingRefresh: Promise<boolean> | null = null;

  /** Un seul renouvellement à la fois : les 401 simultanés attendent le même. */
  function refreshOnce(activeSession: ApiSession): Promise<boolean> {
    pendingRefresh ??= activeSession
      .refresh()
      .then((refreshed) => {
        if (!refreshed) {
          activeSession.clear();
        }
        return refreshed;
      })
      .finally(() => {
        pendingRefresh = null;
      });
    return pendingRefresh;
  }

  async function exchange(
    path: ApiPath,
    method: HttpMethod,
    body: unknown,
    accessToken: string | null,
    signal: TSignal,
  ): Promise<ReceivedResponse> {
    const headers: Record<string, string> = { Accept: JSON_MEDIA_TYPE };
    const hasBody = body !== undefined;
    if (hasBody) {
      headers['Content-Type'] = JSON_MEDIA_TYPE;
    }
    if (accessToken !== null) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    let response: FetchResponseLike;
    try {
      // Appel sans receveur : le fetch du navigateur lève « Illegal invocation »
      // s'il est appelé comme méthode d'un autre objet que window.
      response = await fetchFn(`${baseUrl}${path}`, {
        method,
        headers,
        ...(hasBody && { body: JSON.stringify(body) }),
        signal,
      });
    } catch (error) {
      throw new NetworkError('connection', `Requête ${method} ${path} impossible`, {
        cause: error,
      });
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        headers: response.headers,
        body: await readErrorBody(response),
      };
    }
    if (response.status === HTTP_NO_CONTENT) {
      return { ok: true, body: undefined };
    }
    return { ok: true, body: await readJsonBody(response, method, path) };
  }

  /**
   * Envoie la requête et lit sa réponse dans le délai maximal, sinon l'annule. Elle est aussi
   * annulée quand le signal de l'appelant est déclenché.
   */
  async function send(
    path: ApiPath,
    method: HttpMethod,
    body: unknown,
    accessToken: string | null,
    signal: AbortSignalLike | undefined,
  ): Promise<ReceivedResponse> {
    if (signal?.aborted) {
      throw new RequestAbortedError(method, path);
    }
    const timers = runtimeTimers();
    const controller = createAbortController();
    let timer: unknown;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = timers.setTimeout(() => {
        controller.abort();
        reject(
          new NetworkError(
            'timeout',
            `Requête ${method} ${path} sans réponse après ${timeoutMs} ms`,
          ),
        );
      }, timeoutMs);
    });
    // Affectée tout de suite : l'exécuteur d'une promesse s'exécute dès sa création.
    let rejectAborted!: (error: RequestAbortedError) => void;
    const aborted = new Promise<never>((_resolve, reject) => {
      rejectAborted = reject;
    });
    const onAbort = () => {
      controller.abort();
      rejectAborted(new RequestAbortedError(method, path));
    };
    signal?.addEventListener('abort', onAbort);

    try {
      return await Promise.race([
        exchange(path, method, body, accessToken, controller.signal),
        timeout,
        aborted,
      ]);
    } finally {
      timers.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  return {
    async request(path, { method = 'GET', body, signal } = {}) {
      const accessToken = session?.getAccessToken() ?? null;
      const response = await send(path, method, body, accessToken, signal);
      if (response.ok) {
        return response.body;
      }

      const canRefresh =
        response.status === HTTP_UNAUTHORIZED &&
        session !== undefined &&
        accessToken !== null &&
        !path.startsWith(AUTH_PATH_PREFIX);
      if (!canRefresh) {
        throw toApiError(response, method, path);
      }

      // Session vidée entre-temps (refresh refusé pour une requête concurrente) : pas de nouvel essai.
      // Jeton déjà renouvelé par une requête concurrente : rejouer suffit, sans nouveau refresh.
      const currentToken = session.getAccessToken();
      const renewed =
        currentToken !== null && (currentToken !== accessToken || (await refreshOnce(session)));
      if (!renewed) {
        throw toApiError(response, method, path);
      }

      const retried = await send(path, method, body, session.getAccessToken(), signal);
      if (retried.ok) {
        return retried.body;
      }
      throw toApiError(retried, method, path);
    },
  };
}
