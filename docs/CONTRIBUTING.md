# Guide de Contribution — Collectionr TCG

> Ce document décrit les règles de contribution au code source. Pour le détail complet du processus (cycle de vie des tickets, WIP limits, réunions, gouvernance), se référer au **Workflow & Contribution Guide** et au **Governance & Réunions** disponibles sur le OneDrive.

---

## Format des Branches

```
COLLR-<NUM-TICKET>/<type>/<description-courte>
```

Exemples :

```
COLLR-042/feat/endpoint-scan-unitaire
COLLR-067/fix/crash-camera-android
COLLR-089/chore/setup-bullmq-worker
COLLR-101/refactor/pipeline-ocr-redis
```

---

## Types de Branches et Commits

| Type | Usage |
|---|---|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `chore` | Tâche technique sans valeur utilisateur (config, setup) |
| `refactor` | Refactorisation sans changement de comportement |
| `docs` | Mise à jour de documentation technique |
| `test` | Ajout ou modification de tests |

---

## Format des Commits

```
<type>(<scope>): <description courte en minuscules>
```

Exemples :

```
feat(scan): ajout endpoint POST /scan/unit
fix(auth): correction expiration JWT refresh token
chore(ci): configuration GitHub Actions pipeline backend
refactor(bullmq): simplification worker OCR pipeline
```

---

## Règles essentielles

- Un ticket = une branche
- Jamais de push direct sur `main` ou `develop`
- Toute modification passe par une Pull Request
- Deux yeux minimum : toute PR doit être approuvée par au moins un pair
- La branche est supprimée après merge

---

## Checklist avant PR

- [ ] Tests unitaires passants (couverture ≥ 70 %)
- [ ] ESLint et Prettier sans erreur
- [ ] Aucun `any` TypeScript introduit
- [ ] Branche à jour avec `develop`
- [ ] Ticket Jira passé en "À valider / Tester"
- [ ] PR référence le ticket (`Closes COLLR-XXX`)

---

## Workflow

```bash
# 1. Créer une branche depuis develop
git checkout -b COLLR-<NUM>/<type>/<description>

# 2. Commiter
git commit -m "<type>(<scope>): description"

# 3. Pousser
git push origin COLLR-<NUM>/<type>/<description>

# 4. Ouvrir une Pull Request sur GitHub

# 5. Après merge, supprimer la branche
```

---

## Spécificités Frontend

Cette section regroupe les règles propres à l'application **frontend** (web + mobile Expo). Les règles générales ci-dessus s'appliquent à tous les environnements ; ce qui suit s'y ajoute pour le frontend.

### Onboarding -- lancer le projet en local

#### Prérequis

| Outil | Version minimum | Installation |
|---|---|---|
| Node.js | 20.x LTS | https://nodejs.org ou `nvm install 20` |
| npm | 10.x | Inclus avec Node.js |
| Git | 2.40+ | https://git-scm.com |
| Expo CLI | Dernière version | `npm install -g expo-cli` |
| Émulateur iOS | Xcode 15+ (macOS) | App Store |
| Émulateur Android | Android Studio + SDK 34 | https://developer.android.com/studio |

#### Étapes

```bash
# 1. Cloner le repository
git clone https://github.com/Collectionr/collectionr_epitech.git
cd collectionr_epitech/frontend

# 2. Installer les dependances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# Editer .env avec les valeurs fournies par l'equipe (demander a Ginn pour l'URL de l'API)

# 4. Lancer l'application web
npm run dev

# 5. Lancer l'application mobile (Expo)
npx expo start
# Puis scanner le QR code avec Expo Go (telephone) ou appuyer sur 'i' (iOS) / 'a' (Android)
```

#### Vérification

L'application est prête quand :
- Web : la page d'accueil s'affiche sur `http://localhost:5173`
- Mobile : l'application démarre sur l'émulateur ou le téléphone
- Pas d'erreur TypeScript dans le terminal (`tsc --noEmit` passe)

### Template Pull Request

Chaque PR frontend doit suivre ce template. Le copier dans la description de la PR GitHub.

```markdown
## Description
<!-- Quoi et pourquoi, pas comment -->

## Captures d'ecran
<!-- Screenshots ou video du resultat, surtout pour les changements visuels -->

## Type de changement
- [ ] Nouvelle fonctionnalite (feat)
- [ ] Correction de bug (fix)
- [ ] Refactoring (refactor)
- [ ] Style / visuel (style)
- [ ] Documentation (docs)
- [ ] Tests (test)
- [ ] Autre (chore)

## Checklist
- [ ] Mon code compile sans erreur TypeScript (`tsc --noEmit`)
- [ ] ESLint passe sans erreur
- [ ] Les tests passent (`npm test`)
- [ ] J'ai ajoute des tests pour la nouvelle logique
- [ ] Le composant est responsive (mobile + desktop)
- [ ] Un skeleton loader est present si le composant charge des donnees
- [ ] Aucun type `any` dans le code
- [ ] Les props publiques ont des commentaires JSDoc
- [ ] Teste sur Chrome + Firefox (web)
- [ ] Teste sur iOS + Android (mobile, si applicable)
- [ ] Aucun `console.log` dans le code
- [ ] Le design respecte les tokens du design system
```

### Definition of Done frontend

Une tâche frontend est considérée terminée quand tous ces critères sont remplis. Ne pas créer la PR tant qu'un critère n'est pas satisfait.

- [ ] Composant responsive (mobile + desktop, sauf si spécifique à une plateforme)
- [ ] Skeleton loader présent si le composant charge des données asynchrones
- [ ] TypeScript strict (aucun `any`, aucun `@ts-ignore`)
- [ ] Commentaires JSDoc sur les interfaces de props exportées
- [ ] Testé sur Chrome + Firefox (web) et iOS + Android (mobile)
- [ ] Aucun `console.log` restant dans le code
- [ ] Tests écrits pour les hooks et la logique métier
- [ ] Les tokens du design system sont utilisés (pas de couleurs/tailles hardcodées)
- [ ] Le code respecte l'ordre des imports défini dans les conventions
- [ ] Le composant gère les états : loading, error, empty, data

#### Checklist rapide avant PR

```
[ ] tsc --noEmit passe
[ ] npm run lint passe
[ ] npm test passe
[ ] Pas de any
[ ] Pas de console.log
[ ] Skeleton present
[ ] Responsive
[ ] JSDoc sur les props
[ ] Tests de logique
```

### Stratégie de tests

Les tests protègent le projet contre les régressions. Sans tests, chaque modification est un pari.

#### Pyramide de tests

```
          /\
         /  \         E2E (peu, lents, couteux)
        /    \        Parcours critiques uniquement
       /------\
      /        \      Integration (moderement)
     /          \     Hooks + services + composants avec logique
    /------------\
   /              \   Unitaire (beaucoup, rapides)
  /                \  Utils, hooks, stores, logique metier
  ------------------
```

| Niveau | Quantité | Vitesse | Ce qu'on teste |
|---|---|---|---|
| Unitaire | Beaucoup | < 1 s par test | Fonctions pures, hooks, stores Zustand |
| Intégration | Modéré | < 5 s par test | Composants avec hooks, interactions avec les services (MSW) |
| E2E | Peu | < 60 s par test | Parcours utilisateur complets : ajout et recherche (web + mobile), scan (mobile uniquement) |

> **Note** : le scan de cartes est une fonctionnalité **mobile uniquement**.

#### Outils

| Outil | Usage | Plateforme |
|---|---|---|
| Jest | Runner de tests, assertions, mocks | Web et Mobile |
| React Testing Library | Rendu et interaction des composants | Web |
| React Native Testing Library | Rendu et interaction des composants | Mobile |
| MSW (Mock Service Worker) | Mock des appels API HTTP | Web et Mobile |
| Playwright | Tests E2E navigateur | Web |

#### Ce qu'on teste en priorité

| Cible | Pourquoi | Exemple |
|---|---|---|
| Hooks custom | Logique métier réutilisable | `useCards`, `usePriceFormatter`, `useCardScanner` |
| Stores Zustand | Actions et transitions d'état | `useCollectionStore`, `useAuthStore` |
| Fonctions utilitaires | Logique pure, facile à tester, impact large | `formatPrice`, `validators`, `sortCards` |
| Composants avec logique conditionnelle | Le rendu dépend de l'état | `CardList` (loading, error, empty, data) |

#### Ce qu'on ne teste PAS unitairement

- Composants purement visuels sans logique (un `Button` qui affiche du texte et appelle `onPress`)
- Styles et mise en page (couverts par les tests E2E ou les revues manuelles)
- Code généré (types, barrel exports)

#### Convention de fichiers

Le fichier de test est placé dans le même dossier que le fichier testé :

```
CardPreview/
|-- CardPreview.tsx
|-- CardPreviewSkeleton.tsx
|-- CardPreview.test.tsx      # Test dans le meme dossier
|-- index.ts
```

#### Seuils de couverture cibles

| Couche | Couverture cible |
|---|---|
| Utils / helpers | 90%+ |
| Hooks custom | 70%+ |
| Stores Zustand | 70%+ |
| Composants avec logique | 60%+ |
| Composants visuels purs | Pas de seuil |

#### Exemple de test : usePriceFormatter

```typescript
// hooks/usePriceFormatter.test.ts

import { renderHook } from '@testing-library/react';
import { usePriceFormatter } from './usePriceFormatter';

describe('usePriceFormatter', () => {
  it('formate un prix positif en euros', () => {
    const { result } = renderHook(() => usePriceFormatter());
    expect(result.current.format(42.5, 'EUR')).toBe('42,50 EUR');
  });

  it('formate un prix a zero', () => {
    const { result } = renderHook(() => usePriceFormatter());
    expect(result.current.format(0, 'EUR')).toBe('0,00 EUR');
  });

  it('ajoute le signe + pour une tendance haussiere', () => {
    const { result } = renderHook(() => usePriceFormatter());
    expect(result.current.formatWithTrend(2.5, 'up', 'EUR')).toBe('+2,50 EUR');
  });

  it('ajoute le signe - pour une tendance baissiere', () => {
    const { result } = renderHook(() => usePriceFormatter());
    expect(result.current.formatWithTrend(1.3, 'down', 'EUR')).toBe('-1,30 EUR');
  });

  it('n\'ajoute pas de signe pour un prix stable', () => {
    const { result } = renderHook(() => usePriceFormatter());
    expect(result.current.formatWithTrend(15.0, 'stable', 'EUR')).toBe('15,00 EUR');
  });
});
```

#### Lancer les tests

```bash
# Tous les tests unitaires et integration
npm test

# Tests avec couverture
npm test -- --coverage

# Tests E2E web (Playwright)
npm run test:e2e:web
```

---

## Contacts

| Sujet | Personne | Rôle |
|---|---|---|
| Design, frontend, questions architecture composants | Francois Dubois | PO / Frontend Lead |
| API, backend, contrats d'interface | Ginn | Backend Lead |
| Architecture globale, décisions produit | Alexis | Tech Lead / Architecte |
| CI/CD, déploiement, infrastructure | Équipe DevOps | DevOps |
| Reconnaissance de cartes, modèle IA | Équipe IA/ML | IA |

En cas de doute sur où placer du code, comment nommer un composant, ou quelle approche choisir, demande à Francois ou Alexis avant de coder. Un alignement de 5 minutes évite un refactoring de 2 heures.

---

**Dernière mise à jour** : Juin 2026
**Pour aller plus loin** : Workflow & Contribution Guide — OneDrive Collectionr
