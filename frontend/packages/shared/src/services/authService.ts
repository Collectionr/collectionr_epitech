import type { AuthStore } from '../stores';
import type { AuthTokens, LoginCredentials, RegisterInput, User } from '../types';
import { ApiError } from './apiClient';
import type { ApiClient, ApiSession } from './apiClient';

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
   * Révoque le jeton de renouvellement auprès du back, puis ferme la session localement, même si
   * l'appel échoue (l'erreur est alors propagée après la fermeture).
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
   * Restaure la session au démarrage : renouvellement, puis profil. Le statut passe ensuite à
   * `authenticated` ou `anonymous`. Une seule exécution par chargement de l'application, même si
   * elle est demandée plusieurs fois (double montage du `StrictMode`).
   */
  restoreSession(): Promise<void>;
  /**
   * Vide la session après un renouvellement refusé : supprime le jeton, ferme la session, et la
   * signale comme expirée si elle était ouverte.
   */
  clearSession(): Promise<void>;
}

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;

const runDirectly: RunExclusive = (task) => task();

/** Erreur levée quand une réponse 2xx n'a pas la forme attendue : contrat de l'API rompu. */
function unexpectedResponse(path: string): Error {
  return new TypeError(`Réponse inattendue de ${path}`);
}

/** Lit un champ d'une réponse non validée, sans en supposer le type. */
function readField(value: unknown, field: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, field) : undefined;
}

function readString(value: unknown, field: string): string | undefined {
  const fieldValue = readField(value, field);
  return typeof fieldValue === 'string' ? fieldValue : undefined;
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

/**
 * Crée le service d'authentification.
 * @param options - Client API, stockage du jeton, store de session et exclusion entre onglets
 * @returns Le service
 */
export function createAuthService(options: AuthServiceOptions): AuthService {
  const { client, storage, store, runExclusive = runDirectly } = options;
  let pendingRefresh: Promise<boolean> | null = null;
  let restoration: Promise<void> | null = null;

  async function refreshTokens(): Promise<boolean> {
    const refreshToken = await storage.getRefreshToken();
    if (refreshToken === null) {
      return false;
    }
    try {
      const body = await client.request('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
      });
      const tokens = parseTokens(body, '/auth/refresh');
      await storage.setRefreshToken(tokens.refreshToken);
      store.getState().setAccessToken(tokens.accessToken);
      return true;
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
    store.getState().endSession({ expired: wasAuthenticated });
    await storage.clearRefreshToken();
  }

  function refresh(): Promise<boolean> {
    pendingRefresh ??= runExclusive(refreshTokens).finally(() => {
      pendingRefresh = null;
    });
    return pendingRefresh;
  }

  async function restore(): Promise<void> {
    try {
      if (!(await refresh())) {
        await clearSession();
        return;
      }
      const user = await me();
      const { accessToken } = store.getState();
      if (accessToken === null) {
        // Session vidée pendant la lecture du profil : rien à restaurer.
        return;
      }
      store.getState().startSession(user, accessToken);
    } catch {
      // Serveur injoignable ou en erreur : le jeton est conservé pour le prochain chargement,
      // l'utilisateur continue en anonyme plutôt que de rester sur l'écran de démarrage.
      store.getState().endSession();
    }
  }

  return {
    store,

    async register(input) {
      const body = await client.request('/auth/register', { method: 'POST', body: input });
      return parseUser(body, '/auth/register');
    },

    async login({ email, password }) {
      const body = await client.request('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      const user = parseUser(readField(body, 'user'), '/auth/login');
      const tokens = parseTokens(body, '/auth/login');
      await storage.setRefreshToken(tokens.refreshToken);
      store.getState().startSession(user, tokens.accessToken);
      return user;
    },

    async logout() {
      const refreshToken = await storage.getRefreshToken();
      try {
        if (refreshToken !== null) {
          await client.request('/auth/logout', { method: 'POST', body: { refreshToken } });
        }
      } finally {
        store.getState().endSession();
        await storage.clearRefreshToken();
      }
    },

    refresh,
    me,

    restoreSession() {
      restoration ??= restore();
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
