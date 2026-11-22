# collectionr_epitech

## Storybook web

Prérequis : Node >= 24.18 et < 25, dépendances installées avec `npm ci` depuis `frontend/`.

Depuis `frontend/`, lancer `npm run storybook`, puis ouvrir http://localhost:6006.
Le backend n'est pas nécessaire. Arrêter le serveur avec Ctrl+C.

Storybook réutilise la configuration Vite, les aliases `@` / `@shared`, PostCSS et Tailwind de `apps/web`,
les tokens de `packages/shared/src/tokens` et les polices locales de l'application.
Le thème Écrin est affiché par défaut. `Atoms/Fondations` permet de vérifier ce raccordement.

Les stories restent à côté de leurs composants :

| Dossier sous `frontend/apps/web/src/components` | Groupe Storybook |
| ----------------------------------------------- | ---------------- |
| `atoms/`                                        | `Atoms`          |
| `molecules/`                                    | `Molecules`      |
| `organisms/`                                    | `Organisms`      |
| `templates/`                                    | `Templates`      |

Créer un fichier `NomDuComposant.stories.tsx` avec un titre local tel que `Text`.
Le préfixe du dossier ajoute automatiquement `Atoms/` : ne pas le répéter dans le titre.
Les titres automatiques héritent aussi du groupe correspondant au dossier.
Les pages d'introduction des niveaux encore vides expliquent leur rôle ; elles ne représentent pas des composants implémentés.
Les stories spécifiques de Text et des autres atomes restent dans leurs tickets respectifs.

Pour générer la version statique : `npm run build-storybook` depuis `frontend/`.
Le résultat est dans `frontend/apps/web/storybook-static/` (ignoré par Git).
Storybook couvre le web ; les contrôles du rendu natif Android/iOS restent séparés.

## Tests et couverture

Prérequis : les mêmes que pour Storybook (Node >= 24.18 et < 25, dépendances installées avec `npm ci` depuis `frontend/`).

Depuis `frontend/`, lancer `npm run test:cov`. C'est la commande que lance la CI frontend.
Elle enchaîne deux étapes et échoue dès que l'une d'elles échoue :

1. Vitest, avec couverture, sur tous ses projets : `apps/web`, `packages/shared` et les tests du preset Tailwind (`styles/`) ;
2. Jest (`jest-expo`), avec couverture, sur `apps/mobile`.

Seuil : 40 % des lignes et 40 % des branches (D03 §4), vérifié séparément pour web + shared (Vitest) et pour le mobile (Jest).
Il est déclaré dans `frontend/vitest.config.ts` et `frontend/apps/mobile/jest.config.js`, jamais dans la CI.
Un fichier source sans test compte à 0 %.

Ne comptent pas : les tests, les stories, les types, les barrels (`index.ts`), les mocks, les fichiers de configuration
(dont le preset Tailwind de `styles/`), les points d'entrée (`main.tsx` côté web, `index.ts` côté mobile)
et l'écran de démonstration des tokens du mobile, réservé au développement.

Les rapports HTML sont écrits dans `frontend/coverage/` (ignoré par Git) :

| Périmètre    | Rapport HTML                              |
| ------------ | ----------------------------------------- |
| web + shared | `frontend/coverage/web-shared/index.html` |
| mobile       | `frontend/coverage/mobile/index.html`     |

## Documentation d'équipe

| Besoin | Où |
|---|---|
| Installer l'environnement local (nouveau membre) | [devops/ONBOARDING.md](./devops/ONBOARDING.md) |
| Contribuer : branches, commits, PR, CI | [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) |
| Cacher une fonctionnalité pas finie | [docs/conventions/feature-flags.md](./docs/conventions/feature-flags.md) |

## Licence

Code source consultable sous [PolyForm Strict 1.0.0](./LICENSE) — **ce n'est pas une licence open source**.
Usage commercial, modification et redistribution interdits. Voir [NOTICE.md](./NOTICE.md).
