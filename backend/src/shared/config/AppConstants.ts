// Fixed, non-secret values shared across modules that do not vary per environment.
// Anything that must be tunable per environment goes in EnvironmentVariables.ts instead.

/** Upper bound for a dependency check (database, cache) in the /health endpoint. */
export const HEALTH_CHECK_TIMEOUT_MS = 2000;

/** How long boot waits for Redis to accept connections before serving traffic anyway. */
export const REDIS_CONNECT_TIMEOUT_MS = 2000;

/** Maximum time to wait for a new PostgreSQL connection. */
export const DATABASE_CONNECTION_TIMEOUT_MS = 2000;

/**
 * RBAC role names (docs/security/S03-api-security.md §5.2), upper case.
 * Seeded into the roles table by prisma/seed.ts; auth (COLLR-447) and RBAC (COLLR-449) reference them by name.
 * MODERATOR is deliberately left out until its scope is defined (COLLR-679, admin back-office).
 */
export const ROLE_NAMES = ['USER', 'ADMIN'] as const;

export type RoleName = (typeof ROLE_NAMES)[number];
