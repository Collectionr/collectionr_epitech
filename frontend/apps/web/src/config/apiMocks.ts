/**
 * Données simulées demandées par `VITE_API_MOCKS`, en dev uniquement (`npm run dev`) :
 * `all` simule toute l'API utilisée par le front (collections), pour travailler sans back.
 */
export type ApiMocksMode = 'all';

const API_MOCKS_MODES: readonly ApiMocksMode[] = ['all'];

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
      `VITE_API_MOCKS doit être vide ou valoir ${API_MOCKS_MODES.join(', ')} (reçu : "${value}")`,
    );
  }
  return mode;
}
