// Fixed, non-secret values shared across modules that do not vary per environment.
// Anything that must be tunable per environment goes in EnvironmentVariables.ts instead.

/** Upper bound for a dependency check (database, cache) in the /health endpoint. */
export const HEALTH_CHECK_TIMEOUT_MS = 2000;

/** Maximum time to wait for a new PostgreSQL connection. */
export const DATABASE_CONNECTION_TIMEOUT_MS = 2000;
