/**
 * Données simulées demandées par `VITE_API_MOCKS`, en dev uniquement (`npm run dev`) :
 * - `catalogue` : seule la recherche dans le catalogue, absente du back (COLLR-459), est simulée ;
 *   le reste part vers la vraie API ;
 * - `all` : toute l'API utilisée par le front est simulée (catalogue et collections), pour
 *   travailler sans back.
 */
export type ApiMocksMode = 'catalogue' | 'all';

const API_MOCKS_MODES: readonly ApiMocksMode[] = ['catalogue', 'all'];

/**
 * Lit le réglage des données simulées.
 * @param value - Valeur de `VITE_API_MOCKS`, éventuellement absente ou vide
 * @returns Le mode demandé, ou `null` si aucune donnée simulée n'est demandée
 * @throws {Error} Si la valeur n'est pas un mode connu : une faute de frappe ne passe pas en silence
 */
export function resolveApiMocks(value: string | undefined): ApiMocksMode | null {
  if (!value) {
    return null;
  }
  const mode = API_MOCKS_MODES.find((candidate) => candidate === value);
  if (mode === undefined) {
    throw new Error(
      `VITE_API_MOCKS doit être vide ou valoir ${API_MOCKS_MODES.join(' ou ')} (reçu : "${value}")`,
    );
  }
  return mode;
}
