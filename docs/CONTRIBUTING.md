#  Vue d'ensemble

Ce document définit les règles, les outils et les normes partagés par l'ensemble des développeurs du projet. Ces directives s'appliquent indistinctement aux environnements **front-end** et **back-end** afin de garantir l'homogénéité et la qualité de la base de code globale.

---

##  Gestion des Versions et Collaboration

Le travail collaboratif repose sur des règles strictes de gestion de version.

### Format des Branches

- **Structure obligatoire** : `COLLR-<NUM-TICKET>/<type>/<nom-de-la-tâche>`
- **Un seul ticket par branche** : Il est impératif d'associer un seul ticket à chaque branche
- **Pas de modifications directes sur main** : Les modifications directes sur la branche principale sont interdites
- **Intégration par Pull Requests** : Les intégrations se font exclusivement par l'intermédiaire de requêtes de fusion (Pull Requests)
- **Suppression après fusion** : Les branches doivent être supprimées une fois la fusion validée

**Exemples** :
```
COLLR-100/feat/add-dark-mode
COLLR-101/fix/resolve-authentication-bug
COLLR-102/docs/update-api-documentation
```

### Conventions de Validation (Commits)

Les messages de validation doivent préciser la nature de la modification.

**Types prioritaires**  :
- `feat` → nouvelle fonctionnalité
- `fix` → correction de bug
- `test` → ajout de vérifications automatiques

**Périmètres autorisés** :
- `docs` → documentation
- `arch` → architecture
- `cloud` → infrastructure cloud
- `security` → sécurité
- `devops` → pipelines, CI/CD

**Format recommandé** :
```
<type>(<scope>): <description>

Exemple:
feat(docs): add user authentication guide
fix(security): update dependency vulnerabilities
```

---

##  Langage de Programmation et Typage

Le projet utilise **TypeScript** sur l'intégralité de la base de code.

### Typage Strict (Obligatoire)

- Le compilateur TypeScript est configuré de manière **stricte** via l'option `strict: true` dans `tsconfig.json`
- Cette configuration active tous les contrôles de type stricts possibles

### Interdiction du Type `any` 

- L'utilisation du type `any` est **formellement interdite**
- En cas d'incertitude sur la structure d'une donnée, utiliser le type `unknown`
- Le type `unknown` impose une **vérification structurelle** avant toute manipulation

```typescript
//  Interdit
function process(data: any): void {
  data.method();
}

//  Correct
function process(data: unknown): void {
  if (typeof data === 'object' && data !== null) {
    // manipulation sécurisée de data
  }
}
```

### Structures de Données

- Les **objets et structures de données standards** doivent être définis par des **interfaces**
- L'utilisation des **unions** ou des **intersections** de types nécessite l'emploi du mot-clé `type`

```typescript
// Interface pour les objets
interface Utilisateur {
  id: string;
  nom: string;
  email: string;
}

// Type pour les unions/intersections
type Resultat = Succes | Erreur;
type Permissions = Admin & Moderateur;
```

---

##  Normes de Codage et Formatage

L'uniformité du code entre les différents développeurs est **automatisée par des outils d'analyse**.

### Analyse et Présentation

**ESLint**
- Appliqué pour garantir le respect de la syntaxe
- Identifie les mauvaises pratiques
- Configuration centralisée dans `.eslintrc.json`


---

##  Analyse Continue

La vérification de la qualité du code est **centralisée** dans le pipeline de déploiement continu.

### SonarQube

**SonarQube** est intégré au processus de déploiement continu :

- **Analyse approfondie** : À chaque ajout de code sur le serveur, une analyse complète est effectuée
- **Évaluation de qualité** : Mesure la qualité globale du code
- **Détection de sécurité** : Identifie les failles de sécurité
- **Identification de dette technique** : Repère les zones nécessitant une révision ultérieure

**Métriques analysées** :
- Couverture de tests
- Complexité cyclomatique
- Duplications de code
- Vulnérabilités connues
- Bugs potentiels

---

##  Principes de Sécurité Transversaux

La sécurité s'applique dès la conception de l'architecture.

### Gestion des Accès

L'ensemble des accès aux composants et aux données est régi par le **principe du moindre privilège** :

- Chaque entité ne dispose que des **droits strictement nécessaires** à son fonctionnement
- Les tokens et credentials sont limités en durée de vie
- Les accès sont régulièrement audités et révoqués si inutilisés

### Confiance et Isolation

**Principe du Zero Trust**
- Aucune communication n'est considérée comme fiable par défaut
- Chaque accès doit être **authentifié**, **autorisé** et **tracé**
- Validation constante de la confiance

**Isolation des Environnements**
- Les environnements de **développement**, **test** et **production** font l'objet d'une **isolation stricte**
- Aucune donnée de production n'est autorisée dans les environnements de développement
- Les secrets et credentials sont différents par environnement
- Les accès inter-environnements sont limités et loggés

**Exemples de séparation** :
```
Development  → Base de données locale / données test
Testing      → Base de données dédiée / données anonymisées
Production   → Accès restreint / données réelles / audit complet
```

---

##  Checklist de Conformité

Avant de soumettre une Pull Request, vérifiez que :

- [ ] La branche suit le format `COLLR-<NUM>/<type>/<nom>`
- [ ] Les commits suivent le format `<type>(<scope>): <description>`
- [ ] Tous les types TypeScript sont explicites (pas de `any`)
- [ ] ESLint passe sans erreurs (vérification locale)
- [ ] Prettier a formaté le code (vérification locale)
- [ ] Les tests sont écrits et passent
- [ ] Pas de secrets ou credentials en dur dans le code
- [ ] La documentation est à jour si nécessaire
- [ ] Les règles de sécurité sont respectées

---

##  Ressources Complémentaires

- [TypeScript - Handbook](https://www.typescriptlang.org/docs/)
- [ESLint Documentation](https://eslint.org/docs/rules/)
- [Prettier Documentation](https://prettier.io/docs/en/index.html)
- [SonarQube](https://www.sonarqube.org/)
- [OWASP Security Guidelines](https://owasp.org/)
- [Zero Trust Architecture](https://www.nist.gov/publications/zero-trust-architecture)

---

**Dernière mise à jour** : Mars 2026  
**Mainteneurs** : Équipe Technique  
**Remarques** : N'hésitez pas à proposer des améliorations ! 
