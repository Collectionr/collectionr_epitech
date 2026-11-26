/** Variables d'environnement exposées au client par Vite (préfixe `VITE_`), figées au build. */
interface ImportMetaEnv {
  /** URL de base de l'API, `/api/v1` par défaut : chemin du même domaine ou URL http(s) absolue, vérifiée dans config/api.ts */
  readonly VITE_API_BASE_URL?: string;
  /** Données simulées en dev (`all`), vide par défaut ; vérifiée dans config/apiMocks.ts, ignorée au build */
  readonly VITE_API_MOCKS?: string;
}
