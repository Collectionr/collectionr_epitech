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
| [01-architecture.md](./01-architecture.md) | Structure des dossiers, couches, regles d'organisation |
| [02-design-system.md](./02-design-system.md) | Couleurs, typographie, espacements, animations |
| [03-composants.md](./03-composants.md) | Atomic Design, templates, conventions de composants |
| [04-conventions-code.md](./04-conventions-code.md) | TypeScript, nommage, imports, anti-patterns |
| [05-data-et-etat.md](./05-data-et-etat.md) | Zustand, TanStack Query, regles de decision |
| [06-contributing.md](./06-contributing.md) | Onboarding, Git, Definition of Done, tests |

---

## Par ou commencer ?

Si tu arrives sur le projet pour la premiere fois :

1. Lis ce README jusqu'au bout
2. Lis [01-architecture.md](./01-architecture.md) pour comprendre ou tout se trouve
3. Lis [04-conventions-code.md](./04-conventions-code.md) pour connaitre les regles avant d'ecrire la moindre ligne
4. Lis [06-contributing.md](./06-contributing.md) pour lancer le projet en local
5. Consulte [02-design-system.md](./02-design-system.md) et [03-composants.md](./03-composants.md) au moment ou tu crees tes premiers composants
