/** Variables d'environnement exposées au client par Vite (préfixe `VITE_`), figées au build. */
interface ImportMetaEnv {
  /** URL de base de l'API, `/api/v1` par défaut */
  readonly VITE_API_BASE_URL?: string;
}
