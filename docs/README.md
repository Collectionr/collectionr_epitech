# Documentation Cloud, Sécurité & DevOps

## Objectif du dossier
Ce dossier regroupe l’ensemble des **travaux d’architecture Cloud et de Cybersécurité**
réalisés dans le cadre du cahier des charges du projet.

L’objectif est de définir une **plateforme cloud sécurisée, portable et scalable**, adaptée
à une application **multi-plateforme (web & mobile)**, sans entrer dans les détails
d’implémentation du front-end, du back-end ou de l’IA.

Cette documentation sert de **référence d’architecture** pour les équipes applicatives
et de **support d’évaluation** pour le jury.

---

## Périmètre couvert

### Inclus
- Architecture cloud de référence (cloud-agnostique)
- Sécurité by design (API, données, accès, infrastructure)
- Portabilité multi-cloud
- DevOps, CI/CD et observabilité
- Performance, disponibilité et continuité de service
- Conformité RGPD (niveau architecture)

### Hors périmètre
- Implémentation du code front-end
- Implémentation du code back-end
- Détails algorithmiques ou techniques des modèles IA
- UX/UI et logique métier détaillée

> **Note :** cette documentation définit des **contraintes, exigences et patterns**
auxquels les équipes applicatives devront se conformer.

---

## Organisation du dossier

```text
/docs
  /architecture   → Vision, architecture logique & technique, ADR
  /cloud          → Principes cloud, choix technologiques, IAM, réseau, coûts
  /security       → Threat model, sécurité API, upload, RGPD, audit
  /devops         → CI/CD, observabilité, qualité & scans
  /diagrams       → Schémas d’architecture (draw.io)
```

---

## Architecture : principes directeurs

- **API-first** : une API unique est exposée pour l’ensemble des clients web et mobile.
- **Cloud-agnostic** : aucune dépendance bloquante à un fournisseur cloud spécifique.
- **Scalabilité horizontale** : capacité à monter en charge par ajout de ressources.
- **Traitements asynchrones** : les opérations lourdes sont exécutées via des mécanismes asynchrones.
- **Sécurité by design** : la sécurité est intégrée dès la conception, avec une approche de défense en profondeur.
- **Observabilité native** : journalisation, métriques et alertes intégrées à la plateforme.

---

## Cross-platform (Web & Mobile)

La plateforme est conçue pour être utilisée à la fois :
- par une application web (SPA),
- par une application mobile.

Cela implique notamment :
- une gestion des identités et des sessions compatible web et mobile,
- des APIs versionnées et stables,
- des mécanismes d’upload résilients,
- des exigences de performance adaptées aux réseaux mobiles.

Les choix UX/UI restent hors périmètre, mais les **contraintes techniques associées**
sont documentées dans cette section.

---

## Architecture Decision Records (ADR)

Les décisions structurantes sont formalisées sous forme d’Architecture Decision Records (ADR),
stockés dans le dossier suivant :

```text
/docs/architecture/04-adr/
```

Chaque ADR contient :
- le contexte,
- la décision prise,
- la justification,
- les conséquences.

Cette approche permet d’assurer la traçabilité et la compréhension des choix d’architecture.

---

## Schémas d’architecture

Les schémas d’architecture sont stockés dans le dossier suivant :

```text
/docs/diagrams/
```

Ils représentent :
- l’architecture logique,
- les flux techniques,
- les zones de confiance,
- le déploiement,
- la chaîne CI/CD.

Les schémas sont volontairement indépendants d’un fournisseur cloud afin de garantir la portabilité.
