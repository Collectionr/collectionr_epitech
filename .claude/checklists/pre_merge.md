# Checklist avant PR / merge

Depuis `backend/` :

- [ ] `npm run lint` — zéro erreur
- [ ] `npm run format:check` — zéro écart Prettier
- [ ] `npm test` — tous verts
- [ ] `npm run test:cov` — seuil global ≥ 70 % tenu
- [ ] `npm run test:e2e` — tous verts (sans infra réelle)
- [ ] `npm run build` — compile

Contenu :

- [ ] Fichiers en PascalCase, logique métier hors des controllers, domaine sans import framework
- [ ] Nouvelle variable d'env → ajoutée dans `EnvironmentVariables.ts` **et** `.env.example` (jamais de secret réel commité)
- [ ] Aucun nombre magique de config (timeout, pool, limite…) en dur : variable d'env si ça varie par environnement, sinon constante nommée dans `src/shared/config/`
- [ ] Nouvelle route → `@ApiTags` + décorateurs de réponse Swagger, DTO validés class-validator
- [ ] Erreurs levées via `HttpException` (le filtre global formate) — pas de try/catch qui avale
- [ ] Tests unitaires pour la logique ajoutée, e2e si nouveau endpoint
- [ ] `.claude/contexts/project_state.md` mis à jour si ticket terminé / décision prise / piège découvert

Git :

- [ ] Commits en français, conventional, clé Jira en suffixe `(COLLR-xxx)`
- [ ] Branche `COLLR-xxx/...`, PR relue par 2 personnes minimum
