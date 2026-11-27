import type { AuthStore } from '../stores';
import type { AuthTokens, LoginCredentials, RegisterInput, SessionEndReason, User } from '../types';
import { ApiError } from './apiClient';
import type { ApiClient, ApiSession } from './apiClient';
import { readField, readString, unexpectedResponse } from './responseReaders';

/**
 * Stockage persistant du jeton de renouvellement, fourni par l'application : `localStorage` sur web,
 * stockage sécurisé sur mobile. Asynchrone pour accepter les deux.
 */
export interface TokenStorage {
  /** Jeton enregistré, ou `null` s'il n'y en a pas */
  getRefreshToken(): Promise<string | null>;
  /** Enregistre le jeton, en remplaçant le précédent */
  setRefreshToken(refreshToken: string): Promise<void>;
  /** Supprime le jeton */
  clearRefreshToken(): Promise<void>;
}

/**
 * Exécute une tâche en exclusion mutuelle avec les autres onglets (Web Locks sur web). Le jeton de
 * renouvellement est à usage unique : deux onglets qui le présentent en même temps feraient
 * révoquer toute la chaîne de connexion par le back.
 */
export type RunExclusive = <T>(task: () => Promise<T>) => Promise<T>;

/** Options de création du service d'authentification. */
export interface AuthServiceOptions {
  /** Client API, configuré avec la session de ce service (`createAuthSession`) */
  client: ApiClient;
  /** Stockage du jeton de renouvellement */
  storage: TokenStorage;
  /** Store de session */
  store: AuthStore;
  /** Exclusion entre onglets pour le renouvellement ; exécution directe par défaut */
  runExclusive?: RunExclusive;
}

/** Service d'authentification : appels `/auth/*` et `/users/me`, jetons et store de session. */
export interface AuthService {
  /** Store de session alimenté par ce service */
  readonly store: AuthStore;
  /**
   * Crée un compte, sans ouvrir de session (le back ne renvoie pas de jetons).
   * @returns L'utilisateur créé
   */
  register(input: RegisterInput): Promise<User>;
  /**
   * Connecte l'utilisateur : enregistre le jeton de renouvellement et ouvre la session.
   * @returns L'utilisateur connecté
   */
  login(credentials: LoginCredentials): Promise<User>;
  /**
   * Ferme la session localement, puis révoque le jeton de renouvellement auprès du back. La session
   * reste fermée si cet appel échoue ; l'erreur est alors propagée.
   */
  logout(): Promise<void>;
  /**
   * Renouvelle la paire de jetons. Un seul renouvellement à la fois, en exclusion entre onglets ;
   * le jeton est relu dans le stockage juste avant l'appel.
   * @returns `true` si un nouveau jeton d'accès est disponible, `false` si le back refuse le jeton
   * @throws L'erreur réseau ou serveur, le jeton étant alors conservé
   */
  refresh(): Promise<boolean>;
  /** @returns Le profil de l'utilisateur connecté (`GET /users/me`) */
  me(): Promise<User>;
  /**
   * Restaure la session au démarrage : renouvellement, puis profil. Le statut passe à
   * `authenticated`, ou à `anonymous` si le jeton est absent ou refusé. Si le serveur est
   * injoignable ou en erreur, le statut reste `unknown` avec `restoreError` : le jeton est conservé
   * et un nouvel appel relance la restauration. Une fois aboutie, une seule exécution par
   * chargement de l'application, même demandée plusieurs fois (double montage du `StrictMode`).
   */
  restoreSession(): Promise<void>;
  /**
   * Vide la session après un renouvellement refusé : supprime le jeton, ferme la session, et la
   * signale comme expirée (`endReason`) si elle était ouverte.
   */
  clearSession(): Promise<void>;
}

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;

const runDirectly: RunExclusive = (task) => task();

/** Levée par `login` quand la session est fermée pendant l'appel : sa réponse est périmée. */
export class SessionClosedError extends Error {
  constructor() {
    super('Session fermée pendant la connexion');
    this.name = 'SessionClosedError';
  }
}

function parseUser(value: unknown, path: string): User {
  const id = readString(value, 'id');
  const email = readString(value, 'email');
  const username = readString(value, 'username');
  const createdAt = readString(value, 'createdAt');
  if (
    id === undefined ||
    email === undefined ||
    username === undefined ||
    createdAt === undefined
  ) {
    throw unexpectedResponse(path);
  }
  return { id, email, username, createdAt };
}

function parseTokens(value: unknown, path: string): AuthTokens {
  const accessToken = readString(value, 'accessToken');
  const refreshToken = readString(value, 'refreshToken');
  if (accessToken === undefined || refreshToken === undefined) {
    throw unexpectedResponse(path);
  }
  return { accessToken, refreshToken };
}

/** Un jeton refusé (invalide, expiré, révoqué ou illisible) ne sera jamais accepté plus tard. */
function isRejectedToken(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === HTTP_UNAUTHORIZED || error.status === HTTP_BAD_REQUEST)
  );
}

/** Profil refusé (jeton refusé, compte supprimé) : la session ne peut pas être restaurée. */
function isInvalidSession(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === HTTP_UNAUTHORIZED || error.status === HTTP_NOT_FOUND)
  );
}

/**
 * Crée le service d'authentification.
 * @param options - Client API, stockage du jeton, store de session et exclusion entre onglets
 * @returns Le service
 */
export function createAuthService(options: AuthServiceOptions): AuthService {
  const { client, storage, store, runExclusive = runDirectly } = options;
  let pendingRefresh: Promise<boolean> | null = null;
  let restoration: Promise<void> | null = null;
  /**
   * Génération de session, incrémentée à chaque fermeture (déconnexion, renouvellement refusé).
   * Une réponse de refresh, de login ou de restauration n'écrit jeton ni statut que si la
   * génération n'a pas changé depuis son envoi : sinon elle appartient à une session fermée.
   */
  let generation = 0;

  /**
   * Ferme la session localement. Le refresh en cours est abandonné : sa réponse sera ignorée, et un
   * refresh demandé ensuite part de zéro au lieu de s'y raccrocher. Une session déjà anonyme garde
   * sa raison de fermeture (une déconnexion ne devient pas une fermeture sans raison).
   */
  async function closeSession(reason: SessionEndReason | undefined): Promise<void> {
    generation += 1;
    pendingRefresh = null;
    if (store.getState().status !== 'anonymous') {
      store.getState().endSession({ reason });
    }
    await storage.clearRefreshToken();
  }

  /**
   * Enregistre une nouvelle paire de jetons si la session n'a pas été fermée depuis `sentAt`. Une
   * fermeture pendant l'écriture du stockage efface aussitôt le jeton tout juste écrit.
   * @returns `true` si les jetons sont enregistrés, `false` si la réponse est périmée
   */
  async function saveTokens(tokens: AuthTokens, sentAt: number): Promise<boolean> {
    if (generation !== sentAt) {
      return false;
    }
    store.getState().setAccessToken(tokens.accessToken);
    await storage.setRefreshToken(tokens.refreshToken);
    if (generation !== sentAt) {
      await storage.clearRefreshToken();
      return false;
    }
    return true;
  }

  async function refreshTokens(): Promise<boolean> {
    const sentAt = generation;
    const refreshToken = await storage.getRefreshToken();
    if (refreshToken === null || generation !== sentAt) {
      return false;
    }
    try {
      const body = await client.request('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
      });
      return await saveTokens(parseTokens(body, '/auth/refresh'), sentAt);
    } catch (error) {
      if (isRejectedToken(error)) {
        return false;
      }
      throw error;
    }
  }

  async function me(): Promise<User> {
    return parseUser(await client.request('/users/me'), '/users/me');
  }

  async function clearSession(): Promise<void> {
    const wasAuthenticated = store.getState().status === 'authenticated';
    await closeSession(wasAuthenticated ? 'expired' : undefined);
  }

  function refresh(): Promise<boolean> {
    if (pendingRefresh === null) {
      const attempt = runExclusive(refreshTokens).finally(() => {
        // Une fermeture a pu abandonner ce refresh et un autre a pu partir depuis : ne pas l'effacer.
        if (pendingRefresh === attempt) {
          pendingRefresh = null;
        }
      });
      pendingRefresh = attempt;
    }
    return pendingRefresh;
  }

  /** @returns `true` si la session est tranchée (ouverte ou anonyme), `false` si l'essai a échoué */
  async function restore(): Promise<boolean> {
    const sentAt = generation;
    store.getState().clearRestoreError();
    try {
      if (!(await refresh())) {
        await clearSession();
        return true;
      }
      const user = await me();
      const { accessToken } = store.getState();
      // Session fermée pendant la lecture du profil : elle est déjà anonyme, rien à ouvrir.
      if (generation === sentAt && accessToken !== null) {
        store.getState().startSession(user, accessToken);
      }
      return true;
    } catch (error) {
      if (generation !== sentAt) {
        // Session fermée entre-temps : son échec n'a plus rien à signaler.
        return true;
      }
      if (isInvalidSession(error)) {
        await clearSession();
        return true;
      }
      // Serveur injoignable ou en erreur : le jeton est conservé, l'écran d'erreur propose de
      // réessayer ; la session reste indéterminée plutôt que de passer pour anonyme.
      store.getState().failRestore(error);
      return false;
    }
  }

  return {
    store,

    async register(input) {
      const body = await client.request('/auth/register', { method: 'POST', body: input });
      return parseUser(body, '/auth/register');
    },

    async login({ email, password }) {
      const sentAt = generation;
      const body = await client.request('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      const user = parseUser(readField(body, 'user'), '/auth/login');
      const tokens = parseTokens(body, '/auth/login');
      if (generation !== sentAt) {
        throw new SessionClosedError();
      }
      await storage.setRefreshToken(tokens.refreshToken);
      if (generation !== sentAt) {
        await storage.clearRefreshToken();
        throw new SessionClosedError();
      }
      store.getState().startSession(user, tokens.accessToken);
      return user;
    },

    async logout() {
      // Jeton relevé avant la fermeture, qui le supprime du stockage, pour le révoquer ensuite.
      const refreshToken = await storage.getRefreshToken();
      await closeSession('logout');
      if (refreshToken !== null) {
        await client.request('/auth/logout', { method: 'POST', body: { refreshToken } });
      }
    },

    refresh,
    me,

    restoreSession() {
      restoration ??= restore().then((settled) => {
        if (!settled) {
          restoration = null;
        }
      });
      return restoration;
    },

    clearSession,
  };
}

/**
 * Session du client API, reliée au store et au service d'authentification. Le service est lu à
 * chaque appel : le client et le service se référencent mutuellement, le service est créé après.
 * @param store - Store de session, source du jeton d'accès
 * @param getAuthService - Renvoie le service d'authentification de l'application
 * @returns La session à passer à `createApiClient`
 */
export function createAuthSession(store: AuthStore, getAuthService: () => AuthService): ApiSession {
  return {
    getAccessToken: () => store.getState().accessToken,
    refresh: () => getAuthService().refresh(),
    clear: () => {
      void getAuthService().clearSession();
    },
  };
}
