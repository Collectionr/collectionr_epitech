/// <reference types="expo/types" />

declare namespace NodeJS {
  /** Variables d'environnement exposées au client par Expo (préfixe `EXPO_PUBLIC_`), figées au bundle. */
  interface ProcessEnv {
    /** URL absolue de l'API (ex. : "http://localhost:3000/api/v1"), obligatoire à l'exécution, vérifiée dans config/api.ts */
    EXPO_PUBLIC_API_URL?: string;
  }
}
