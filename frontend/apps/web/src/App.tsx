import { APP_NAME } from '@shared/constants';

/** Racine de l'application web. */
export function App() {
  return (
    <main className="p-space-24">
      <h1 className="text-h1">{APP_NAME}</h1>
    </main>
  );
}
