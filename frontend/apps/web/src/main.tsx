import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/App';

import '@/styles/fonts';
import '@/styles/globals.css';

/**
 * Données simulées demandées par `VITE_API_MOCKS` (data-et-etat.md), démarrées avant le premier
 * rendu pour qu'aucune requête ne leur échappe. Sous `vite build`, la condition vaut `false` :
 * ni MSW ni les handlers n'entrent dans le build de production.
 */
async function startApiMocksInDev(): Promise<void> {
  if (!import.meta.env.DEV) {
    return;
  }
  const { resolveApiMocks } = await import('@/config/apiMocks');
  const mode = resolveApiMocks(import.meta.env.VITE_API_MOCKS);
  if (mode === null) {
    return;
  }
  const [{ startApiMocks }, { resolveApiBaseUrl }] = await Promise.all([
    import('@/mocks/browser'),
    import('@/config/api'),
  ]);
  await startApiMocks(mode, resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL));
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Élément #root introuvable dans index.html');
}

void startApiMocksInDev().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
