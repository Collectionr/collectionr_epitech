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

## Licence

Code source consultable sous [PolyForm Strict 1.0.0](./LICENSE) — **ce n'est pas une licence open source**.
Usage commercial, modification et redistribution interdits. Voir [NOTICE.md](./NOTICE.md).
