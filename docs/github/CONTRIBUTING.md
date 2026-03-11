# Guide GitHub - Normes et Bonnes Pratiques

> **Note importante** : Ce document n'est pas définitif. Si vous avez des suggestions, des préférences ou des idées, n'hésitez pas à en parler ! Le but est de créer l'environnement de travail le plus sain possible, et nous comptons sur tout le monde pour jouer le jeu. 🙂
>
> N'hésitez pas à partager vos retours dans le salon `#suggestions` pour que nous gardions ce canal uniquement pour les questions et pépins liés à Git.

---

##  Format des Branches

### Structure de base

```
COLLR-<NUM-TICKET>/<type>/<nom-de-la-tâche>
```

### Exemples

```
COLLR-287/feat/add-filter-card-pokemon
COLLR-42/fix/resolve-cache-issue
COLLR-150/docs/update-installation-guide
```

---

##  Types de Commits

### Types principaux (à privilégier )

| Type | Description | Exemple |
|------|-------------|---------|
| **feat** | Ajout d'une nouvelle fonctionnalité | `feat: add user authentication` |
| **fix** | Correction d'un bug | `fix: resolve memory leak in cache` |
| **test** | Ajout ou modification de tests | `test: add unit tests for auth service` |

### Autres Types possibles

| Type | Description |
|------|-------------|
| **chore** | Modifications diverses (maj de versions, nettoyage, etc.) |
| **refactor** | Modification du code sans ajout de fonctionnalité ni correction de bug (renommage, simplification, etc.) |
| **build** | Changements liés au système de build ou aux dépendances (npm, webpack, etc.) |
| **ci** | Intégration / déploiement continu (GitHub Actions, GitLabCI, etc.) |
| **perf** | Amélioration des performances |
| **style** | Changement de style du code (indentation, formatage, etc.) |
| **revert** | Annulation d'un précédent commit |

> 💡 Cette liste n'est pas exhaustive et peut être complétée selon vos besoins.

---

##  Scopes Autorisés

Les scopes permettent de préciser sur quoi porte la tâche ou le commit :

| Scope | Description |
|-------|-------------|
| **docs** | Documentation, README, guides, etc. |
| **arch** | Architecture logicielle, structure globale du projet |
| **cloud** | Infra cloud, déploiement, configuration distante |
| **security** | Sécurité, permissions, secrets, vulnérabilités |
| **devops** | Pipelines, CI/CD, scripts de déploiement |
| **diagrams** | Schémas, diagrammes d'architecture ou de flux |
| **adr** | Architecture Decision Records |
| **chore** | Tâches diverses de maintenance / ménage |

### Exemples

```
COLLR-123/feat/docs-add-installation-guide
COLLR-456/fix/security-update-dependency
COLLR-789/refactor/arch-simplify-service-structure
```

---

##  Verbes d'Action Recommandés

Utilisez ces verbes dans les descriptions ou noms de branches pour clarifier l'intention :

| Verbe | Utilisation |
|-------|-------------|
| **add** | Ajout de contenu ou fonctionnalité |
| **update** | Mise à jour de contenu existant |
| **refine** | Amélioration / affinement de quelque chose d'existant |
| **restructure** | Réorganisation sans changement fonctionnel |
| **clarify** | Rendre plus clair (code, docs, noms, etc.) |
| **finalize** | Mise en forme finale avant release / validation |

### Exemples de branches complètes

```
COLLR-100/feat/add-dark-mode
COLLR-101/fix/clarify-error-messages
COLLR-102/docs/update-contribution-guide
COLLR-103/refactor/arch-restructure-database-layer
```

---

##  Règles à Retenir

###  À privilégier

- Utilisez en priorité les types : **feat**, **fix** et **test**
- Commencez vos branches par `COLLR-<NUM-TICKET>/`
- Soyez descriptif et clair dans les noms de branches

###  Important

- Un ticket = une branche
- Une feature complète = un ou plusieurs commits bien structurés
- Les branches doivent être supprimées après fusion (via une PR reviewed)

###  À éviter

- ~~Noms de branches vagues~~ ❌ (ex: `fix/stuff`, `COLLR-100/update`)
- ~~Commits de rebase complexes~~ ❌ (gardez l'historique lisible)
- ~~Pousser directement sur main~~ ❌ (toujours via des Pull Requests)

---

##  Workflow Recommandé

```bash
# 1. Créer une nouvelle branche
git checkout -b COLLR-<NUM>/<type>/<description>

# 2. Faire vos commits
git commit -m "type(scope): description"

# 3. Pousser la branche
git push origin COLLR-<NUM>/<type>/<description>

# 4. Créer une Pull Request sur GitHub
# (description claire, lien vers le ticket)

# 5. Une fois validée et mergée, supprimer la branche
```

---

## 📚 Ressources Complémentaires

- [Conventional Commits](https://www.conventionalcommits.org/) (standard utilisé)
- [Semantic Versioning](https://semver.org/)

---

**Dernière mise à jour** : Mars 2026  
**Remarques** : N'hésitez pas à proposer des améliorations ! 🚀
