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

**Dernière mise à jour** : Juin 2026
**Pour aller plus loin** : Workflow & Contribution Guide — OneDrive Collectionr