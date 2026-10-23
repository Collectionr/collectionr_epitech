import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/App';

import '@fontsource/schibsted-grotesk/latin-400.css';
import '@fontsource/schibsted-grotesk/latin-500.css';
import '@fontsource/schibsted-grotesk/latin-700.css';
import '@fontsource/schibsted-grotesk/latin-800.css';
import '@fontsource/schibsted-grotesk/latin-900.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@/styles/globals.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Élément #root introuvable dans index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
