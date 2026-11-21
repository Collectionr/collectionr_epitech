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
3. **Déclaré comme toute variable d'environnement** :
   - Backend : dans `backend/src/shared/config/EnvironmentVariables.ts` **et** `backend/.env.example` (règle du `CLAUDE.md`) ;
   - microservice TCG : dans `config.py` **et** `.env.example` ;
   - cluster : dans le **ConfigMap** du service (ex. `devops/k3s/backend-config.yaml`), **jamais** dans un Secret.
4. **Côté Front, un flag n'est pas une protection** : il est lu **au moment du build** (changer sa valeur demande de reconstruire
   l'image), et n'importe qui peut le contourner dans son navigateur. Il sert à cacher un bouton ou un écran ;
   **la vraie protection est côté Backend** (la route renvoie `404` tant que son flag est à `false`).
5. **Un flag est temporaire** : une fois la fonctionnalité activée partout, on supprime le flag (code, `.env.example`, ConfigMap)
   **au plus tard au jalon suivant**. On crée le ticket de nettoyage **en même temps** que le flag.
6. **Chaque flag est listé** dans le tableau du §3, avec son ticket de nettoyage.

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
# Feature flag : route /scan (false tant que le scan n'est pas fini). Voir devops/FEATURE-FLAGS.md.
FEATURE_SCAN=false
```

**Dans le code** : si `FEATURE_SCAN` vaut `false`, la route répond `404`, comme si elle n'existait pas.

**Pour l'activer dans le cluster** (`devops/k3s/backend-config.yaml`) :
```yaml
  FEATURE_SCAN: "true"
```
puis `kubectl apply -f devops/k3s/backend-config.yaml` et `kubectl rollout restart deployment/backend --namespace development`.

---

## 3. Flags en cours

| Flag | Service | Valeur en `development` | Rôle | Ticket de nettoyage |
|---|---|---|---|---|
| *(aucun pour l'instant)* | | | | |
