> **Maintenu par :** Francois Dubois (PO / Frontend Lead)
> **Derniere mise a jour :** 2026-03-22
> **Audience :** Toute l'equipe, en particulier les nouveaux contributeurs

# Guide de contribution -- CollectionR Frontend

Ce guide est le point d'entree pour tout nouveau contributeur. Il couvre le setup local, le workflow Git, les regles de Pull Request et la strategie de tests. Si tu arrives sur le projet pour la premiere fois, commence ici.

---

## 1. Onboarding -- lancer le projet en local

### Prerequis

| Outil | Version minimum | Installation |
|---|---|---|
| Node.js | 20.x LTS | https://nodejs.org ou `nvm install 20` |
| npm | 10.x | Inclus avec Node.js |
| Git | 2.40+ | https://git-scm.com |
| Expo CLI | Derniere version | `npm install -g expo-cli` |
| Emulateur iOS | Xcode 15+ (macOS) | App Store |
| Emulateur Android | Android Studio + SDK 34 | https://developer.android.com/studio |

### Etapes

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

### Verification

L'application est prete quand :
- Web : la page d'accueil s'affiche sur `http://localhost:5173`
- Mobile : l'application demarre sur l'emulateur ou le telephone
- Pas d'erreur TypeScript dans le terminal (`tsc --noEmit` passe)

---

## 2. Workflow Git

### Convention de branches

Le format de branche est impose par le projet global (voir [CONTRIBUTING.md](../../docs/CONTRIBUTING.md)).

```
COLLR-<NUM-TICKET>/<type>/<nom-de-la-tache>
```

Pour le frontend, les types courants sont :

| Type | Usage | Exemple |
|---|---|---|
| `feat` | Nouvelle fonctionnalite | `COLLR-150/feat/card-scanner` |
| `fix` | Correction de bug | `COLLR-151/fix/camera-permission-denied` |
| `docs` | Documentation | `COLLR-152/docs/update-design-system` |
| `style` | Changement visuel sans logique | `COLLR-153/style/card-border-radius` |
| `refactor` | Refactoring sans changement fonctionnel | `COLLR-154/refactor/extract-price-hook` |
| `test` | Ajout ou modification de tests | `COLLR-155/test/collection-store` |
| `chore` | Configuration, tooling, dependances | `COLLR-156/chore/update-expo-sdk` |

### Convention de commits (Conventional Commits)

Chaque commit suit le format :

```
<type>(<scope>): <description>
```

Le scope est le domaine fonctionnel touche. Exemples :

```
feat(card): add shimmer loader to CardPreview
fix(scan): handle camera permission denied on Android 14
docs(design): update color palette with new tokens
style(collection): adjust grid spacing on tablet
refactor(hooks): extract usePriceFormatter from useCards
test(store): add tests for useCollectionStore
chore(deps): update TanStack Query to v5.60
```

### Regles Git

- **Jamais de commit direct sur `main`** -- Toujours passer par une branche + Pull Request
- **Une branche = un ticket = une PR** -- Ne pas melanger plusieurs features dans une branche
- **Supprimer la branche apres merge** -- Garder le repo propre
- **Rebase plutot que merge** pour garder l'historique lineaire (sauf si des conflits complexes le rendent risque)

### Template Pull Request

Chaque PR doit suivre ce template. Le copier dans la description de la PR GitHub.

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

### Processus de review

1. Creer la PR avec le template rempli
2. Assigner un reviewer (Francois pour le design/front, Alexis pour l'architecture)
3. Attendre l'approbation (minimum 1 reviewer)
4. Corriger les retours si necessaire
5. Merge via GitHub (squash merge recommande)

---

## 3. Definition of Done frontend

Une tache frontend est consideree terminee quand tous ces criteres sont remplis. Ne pas creer la PR tant qu'un critere n'est pas satisfait.

- [ ] Composant responsive (mobile + desktop, sauf si specifique a une plateforme)
- [ ] Skeleton loader present si le composant charge des donnees asynchrones
- [ ] TypeScript strict (aucun `any`, aucun `@ts-ignore`)
- [ ] Commentaires JSDoc sur les interfaces de props exportees
- [ ] Teste sur Chrome + Firefox (web) et iOS + Android (mobile)
- [ ] Aucun `console.log` restant dans le code
- [ ] Tests ecrits pour les hooks et la logique metier
- [ ] Les tokens du design system sont utilises (pas de couleurs/tailles hardcodees)
- [ ] Le code respecte l'ordre des imports defini dans les conventions
- [ ] Le composant gere les etats : loading, error, empty, data

### Checklist rapide avant PR

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

---

## 4. Strategie de tests

Les tests protegent le projet contre les regressions. Sans tests, chaque modification est un pari.

### Pyramide de tests

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

| Niveau | Quantite | Vitesse | Ce qu'on teste |
|---|---|---|---|
| Unitaire | Beaucoup | < 1 s par test | Fonctions pures, hooks, stores Zustand |
| Integration | Modere | < 5 s par test | Composants avec hooks, interactions avec les services (MSW) |
| E2E | Peu | < 60 s par test | Parcours utilisateur complets (scan, ajout, recherche) |

### Outils

| Outil | Usage | Plateforme |
|---|---|---|
| Jest | Runner de tests, assertions, mocks | Web et Mobile |
| React Testing Library | Rendu et interaction des composants | Web |
| React Native Testing Library | Rendu et interaction des composants | Mobile |
| MSW (Mock Service Worker) | Mock des appels API HTTP | Web et Mobile |
| Detox ou Maestro | Tests E2E sur emulateur/simulateur | Mobile |
| Playwright | Tests E2E navigateur | Web |

### Ce qu'on teste en priorite

| Cible | Pourquoi | Exemple |
|---|---|---|
| Hooks custom | Logique metier reutilisable | `useCards`, `usePriceFormatter`, `useCardScanner` |
| Stores Zustand | Actions et transitions d'etat | `useCollectionStore`, `useAuthStore` |
| Fonctions utilitaires | Logique pure, facile a tester, impact large | `formatPrice`, `validators`, `sortCards` |
| Composants avec logique conditionnelle | Le rendu depend de l'etat | `CardList` (loading, error, empty, data) |

### Ce qu'on ne teste PAS unitairement

- Composants purement visuels sans logique (un `Button` qui affiche du texte et appelle `onPress`)
- Styles et mise en page (couverts par les tests E2E ou les revues manuelles)
- Code genere (types, barrel exports)

### Convention de fichiers

Le fichier de test est place dans le meme dossier que le fichier teste :

```
CardPreview/
|-- CardPreview.tsx
|-- CardPreviewSkeleton.tsx
|-- CardPreview.test.tsx      # Test dans le meme dossier
|-- index.ts
```

### Seuil de couverture cible : 70% sur les hooks et utils

| Couche | Couverture cible |
|---|---|
| Utils / helpers | 90%+ |
| Hooks custom | 70%+ |
| Stores Zustand | 70%+ |
| Composants avec logique | 60%+ |
| Composants visuels purs | Pas de seuil |

### Exemple de test : usePriceFormatter

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

### Lancer les tests

```bash
# Tous les tests unitaires et integration
npm test

# Tests avec couverture
npm test -- --coverage

# Tests E2E mobile (Detox)
npm run test:e2e:mobile

# Tests E2E web (Playwright)
npm run test:e2e:web
```

---

## 5. Contacts

| Sujet | Personne | Role |
|---|---|---|
| Design, frontend, questions architecture composants | Francois Dubois | PO / Frontend Lead |
| API, backend, contrats d'interface | Ginn | Backend Lead |
| Architecture globale, decisions produit | Alexis | Tech Lead / Architecte |
| CI/CD, deploiement, infrastructure | Equipe DevOps | DevOps |
| Reconnaissance de cartes, modele IA | Equipe IA/ML | IA |

En cas de doute sur ou placer du code, comment nommer un composant, ou quelle approche choisir, demande a Francois ou Alexis avant de coder. Un alignement de 5 minutes evite un refactoring de 2 heures.

---

## Voir aussi

- [01-architecture.md](./01-architecture.md) -- Ou placer les fichiers dans l'arborescence
- [04-conventions-code.md](./04-conventions-code.md) -- Regles TypeScript et nommage
- [03-composants.md](./03-composants.md) -- Comment creer un composant
- [05-data-et-etat.md](./05-data-et-etat.md) -- Hooks TanStack Query et stores Zustand a tester
- [CONTRIBUTING.md global](../../docs/CONTRIBUTING.md) -- Regles communes a tout le projet
