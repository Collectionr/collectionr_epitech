# Convention des feature flags — CollectionR

**Pourquoi** : un feature flag est un **interrupteur** qui cache une fonctionnalité pas encore finie. On peut ainsi
**merger le code dans `dev` sans le montrer**, l'activer sur un poste ou un environnement pour le tester, et le couper
sans redéployer de code.

> Proposée par le DevOps, à valider par le lead Back et le lead Front.

---

## 1. Règles

1. **Un flag = une variable d'environnement booléenne** (`true` / `false`), nommée selon le service :

| Service | Nom | Exemple |
|---|---|---|
| Backend, microservice TCG, Workers | `FEATURE_<NOM>` | `FEATURE_SCAN` |
| Front web (Vite) | `VITE_FEATURE_<NOM>` | `VITE_FEATURE_SCAN` |
| Front mobile (Expo) | `EXPO_PUBLIC_FEATURE_<NOM>` | `EXPO_PUBLIC_FEATURE_SCAN` |

2. **Désactivé par défaut** (`false`). Un oubli de configuration cache la fonctionnalité, il ne l'expose jamais par accident.
   **Écris toujours `true` ou `false`, en minuscules.** Le Backend et le Front n'activent un flag qu'avec `true` exactement
   (`TRUE` ou `1` le laissent désactivé), alors que le microservice TCG et les Workers Python (pydantic) acceptent aussi
   `1`, `TRUE`, `yes` ou `on`. Seuls `true` / `false` en minuscules donnent le même résultat partout.
3. **Déclaré comme toute variable d'environnement** :
   - Backend : dans `backend/src/shared/config/EnvironmentVariables.ts` **et** `backend/.env.example` (règle du `CLAUDE.md`) ;
   - microservice TCG : dans `config.py` **et** `.env.example` ;
   - Front web : typé dans `frontend/apps/web/src/vite-env.d.ts` (zéro `any`), et déclaré dans `frontend/apps/web/Dockerfile`
     (`ARG` + `ENV`, comme `VITE_API_BASE_URL`), sinon le build de l'image l'ignore ;
   - Front mobile : typé dans `frontend/apps/mobile/src/env.d.ts` ;
   - cluster, Backend / TCG / Workers : dans le **ConfigMap** du service (ex. `devops/k3s/backend-config.yaml`), **jamais** dans un Secret.
     Chaque environnement a **sa propre valeur** dans son ConfigMap (`development` aujourd'hui, Staging en Beta) ;
   - cluster, Front web : **pas de ConfigMap**, la valeur est figée dans l'image au build :
     `docker build --build-arg VITE_FEATURE_SCAN=true …` (voir la section « Frontend » de `devops/README.md`).
4. **Côté Front, un flag n'est pas une protection** : il est lu **au moment du build** (changer sa valeur demande de reconstruire
   l'image), et n'importe qui peut le contourner dans son navigateur. Il sert à cacher un bouton ou un écran ;
   **la vraie protection est côté Backend** (la route renvoie `404` tant que son flag est à `false`).
5. **Les tests couvrent les 2 positions** : flag activé (la fonctionnalité marche) et désactivé (`404` côté Backend, élément caché côté Front).
6. **Un flag est temporaire** : une fois la fonctionnalité activée partout, on le supprime **au plus tard au jalon suivant**,
   partout où il apparaît : code, tests, `.env.example`, ConfigMap, `vite-env.d.ts` / `env.d.ts`, `Dockerfile` web.
   On crée le ticket de nettoyage **en même temps** que le flag.
7. **Chaque flag est listé** dans le tableau du §4, avec son ticket de nettoyage.

> **À ne pas confondre** avec les réglages permanents d'un environnement, comme `SWAGGER_ENABLED` ou `LOAD_OCR_MODEL`
> (Worker OCR, chargement du modèle sur les postes assez puissants) : ils restent, ce ne sont pas des feature flags.

---

## 2. Exemple : cacher la route `/scan` pendant son développement (Backend)

**`backend/src/shared/config/EnvironmentVariables.ts`** (même lecture booléenne que `SWAGGER_ENABLED`) :
```ts
  /** Feature flag (COLLR-xxx) : route /scan, désactivée tant que le scan n'est pas fini. */
  @Transform(({ value }) => value === true || value === 'true')
  FEATURE_SCAN: boolean = false;
```

**`backend/.env.example`** :
```bash
# Feature flag : route /scan (false tant que le scan n'est pas fini). Voir docs/conventions/feature-flags.md.
FEATURE_SCAN=false
```

**Dans le code** : si `FEATURE_SCAN` vaut `false`, la route répond `404`, comme si elle n'existait pas.

**Pour l'activer dans le cluster** (`devops/k3s/backend-config.yaml`) :
```yaml
  FEATURE_SCAN: "true"
```
puis `kubectl apply -f devops/k3s/backend-config.yaml` et `kubectl rollout restart deployment/backend --namespace development`
(un Pod ne relit pas son ConfigMap tout seul).

---

## 3. Exemple : cacher l'écran de scan (Front)

⚠️ **Piège** : côté Front, une variable d'environnement est **toujours une chaîne de caractères**. `"false"` n'est pas vide,
donc `if (import.meta.env.VITE_FEATURE_SCAN)` serait **vrai** même avec `false`. **Toujours comparer à `'true'`.**

**Web**, `frontend/apps/web/src/vite-env.d.ts` (dans `ImportMetaEnv`) :
```ts
  /** Feature flag (COLLR-xxx) : écran de scan. "true" pour l'afficher, absente ou autre valeur = caché. */
  readonly VITE_FEATURE_SCAN?: string;
```
Dans le code :
```ts
const scanEnabled = import.meta.env.VITE_FEATURE_SCAN === 'true';
```

**Mobile** : même principe, déjà utilisé par `EXPO_PUBLIC_TOKENS_PREVIEW` (`apps/mobile/App.tsx`) :
```ts
const scanEnabled = process.env.EXPO_PUBLIC_FEATURE_SCAN === 'true';
```

---

## 4. Flags en cours

| Flag | Service | Valeur en `development` | Rôle | Ticket de nettoyage |
|---|---|---|---|---|
| *(aucun pour l'instant)* | | | | |
