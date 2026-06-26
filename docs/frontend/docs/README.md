> **Maintenu par :** Francois Dubois (PO / Frontend Lead)
> **Derniere mise a jour :** 2026-03-22
> **Audience :** Toute l'equipe, en particulier les nouveaux contributeurs

# Documentation Frontend -- CollectionR

CollectionR est une application multi-plateforme de gestion de collection de cartes TCG. Le frontend web (React) et mobile (React Native + Expo) partagent un maximum de code commun. La reconnaissance de carte par camera est reservee au mobile ; le desktop permet uniquement l'ajout manuel.

---

## Stack technique

| Technologie | Role | Plateforme |
|---|---|---|
| React | UI web | Web |
| React Native | UI mobile | iOS / Android |
| Expo | Toolchain mobile | iOS / Android |
| TypeScript | Typage statique | Web + Mobile |
| Tailwind CSS | Styles web | Web |
| NativeWind | Styles mobile | iOS / Android |
| Zustand | Etat global | Web + Mobile |
| TanStack Query | Data fetching et cache | Web + Mobile |
| TanStack Virtual | Virtualisation grandes listes | Web + Mobile |
| React Navigation | Navigation mobile | iOS / Android |
| Figma | Wireframes et maquettes | Design |

---

## Index de la documentation

| Fichier | Contenu |
|---|---|
| [architecture.md](./architecture.md) | Structure des dossiers, couches, regles d'organisation |
| [design-system.md](./design-system.md) | Couleurs, typographie, espacements, animations |
| [composants.md](./composants.md) | Atomic Design, templates, conventions de composants |
| [conventions-code.md](./conventions-code.md) | TypeScript, nommage, imports, anti-patterns |
| [data-et-etat.md](./data-et-etat.md) | Zustand, TanStack Query, regles de decision |
| [CONTRIBUTING.md (global)](../../CONTRIBUTING.md) | Onboarding, Git, Definition of Done, tests |

---

## Par ou commencer ?

Si tu arrives sur le projet pour la premiere fois :

1. Lis ce README jusqu'au bout
2. Lis [architecture.md](./architecture.md) pour comprendre ou tout se trouve
3. Lis [conventions-code.md](./conventions-code.md) pour connaitre les regles avant d'ecrire la moindre ligne
4. Lis [CONTRIBUTING.md (global)](../../CONTRIBUTING.md) pour lancer le projet en local
5. Consulte [design-system.md](./design-system.md) et [composants.md](./composants.md) au moment ou tu crees tes premiers composants
