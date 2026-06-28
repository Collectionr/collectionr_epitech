# Principes de sécurité

## Sommaire

1. [Objectif du document](#1-objectif-du-document)
2. [Périmètre](#2-périmètre)
3. [Approche générale](#3-approche-générale)
4. [Principes de sécurité fondamentaux](#4-principes-de-sécurité-fondamentaux)
5. [Gestion des identités et des accès](#5-gestion-des-identités-et-des-accès)
6. [Gestion des secrets](#6-gestion-des-secrets)
7. [Protection des données](#7-protection-des-données)
8. [Journalisation et traçabilité](#8-journalisation-et-traçabilité)
9. [Conformité et protection de la vie privée](#9-conformité-et-protection-de-la-vie-privée)
10. [Évolutivité et amélioration continue](#10-évolutivité-et-amélioration-continue)
11. [Documents associés](#11-documents-associés)

## 1. Objectif du document
Ce document définit les **principes de cybersécurité** appliqués à la plateforme
d’un point de vue **architecture Cloud & DevOps**.

Il sert de **socle de référence** pour l’ensemble des exigences de sécurité détaillées
dans les documents suivants (threat model, sécurité API, conformité RGPD, audit, etc.).

---

## 2. Périmètre
Les principes décrits dans ce document s’appliquent :
- à l’architecture cloud de la plateforme,
- aux APIs exposées aux clients web et mobile,
- aux flux de données,
- aux environnements (dev, staging, production),
- aux processus DevOps.

Les détails d’implémentation applicative (front-end, back-end, IA) sont hors périmètre.

---

## 3. Approche générale

La sécurité est intégrée dès la phase de conception selon une approche
**Security by Design**, complétée par une stratégie de **défense en profondeur**.

L'objectif est de réduire :
- la surface d'attaque,
- l'impact d'un incident,
- les risques de fuite ou de compromission des données.

---

## 4. Principes de sécurité fondamentaux

### Principe du moindre privilège (Least Privilege)
Chaque composant, service ou utilisateur ne dispose que des **droits strictement nécessaires**
à l’exécution de ses fonctions.

Ce principe s’applique notamment :
- aux identités cloud (IAM),
- aux services applicatifs,
- aux accès aux données,
- aux pipelines CI/CD.

---

### Zero Trust
Aucune communication n’est considérée comme fiable par défaut.

Chaque accès doit être :
- authentifié,
- autorisé,
- tracé.

Ce principe s’applique aussi bien aux accès externes qu’aux communications internes
entre services.

---

### Séparation des environnements
Les environnements suivants sont strictement isolés :
- développement,
- staging / test,
- production.

Aucune donnée de production ne doit être utilisée en environnement de développement.
Les accès et secrets sont distincts par environnement.
Les pipelines CI/CD n'ont accès qu'aux secrets et ressources de l'environnement cible. Aucun pipeline de développement ne peut interagir avec l'environnement de production.

### Sécurité de l'orchestration K3s
L'orchestration repose sur K3s. Les mesures de sécurité suivantes s'appliquent :
- les communications entre Pods sont restreintes via des NetworkPolicies ;
- les secrets applicatifs sont gérés via les Secrets Kubernetes,
avec une évolution prévue vers Vault en production
- les droits d'accès au cluster sont définis via RBAC Kubernetes ;
- aucun conteneur ne s'exécute en mode privilégié sauf nécessité explicitement justifiée.

---

### Défense en profondeur
La sécurité repose sur plusieurs couches complémentaires :
- contrôles réseau (segmentation, filtrage),
- contrôles applicatifs (authentification, autorisation),
- contrôles sur les données (chiffrement, accès),
- supervision et journalisation.

La défaillance d’un contrôle ne doit pas compromettre l’ensemble du système.

---

## 5. Gestion des identités et des accès

Ces mesures s'appliquent aussi bien aux utilisateurs humains 
qu'aux services techniques communiquant entre eux au sein du cluster.

- authentification centralisée pour les utilisateurs et les services ;
- gestion des rôles et permissions (RBAC) ;
- séparation des rôles techniques et fonctionnels ;
- rotation et gestion sécurisée des secrets ;
- révocation possible des accès.

---

## 6. Gestion des secrets
Aucun secret ne doit apparaître en clair dans le dépôt Git.
Les secrets sont gérés selon les règles suivantes :

- variables d'environnement injectées via les Secrets Kubernetes en environnement local et staging ;
- évolution prévue vers Vault en production ;
- rotation régulière des secrets critiques (clés API, tokens) ;
- audit des accès aux secrets tracé et journalisé.

---

## 7. Protection des données

Les données sensibles identifiées incluent notamment :
- les comptes utilisateurs,
- les images uploadées,
- les données de collection,
- les historiques d’accès et d’actions.

Les principes suivants s’appliquent :
- chiffrement des données en transit,
- chiffrement des données au repos,
- accès limité selon les rôles,
- traçabilité des accès aux données sensibles.

Dans le contexte de ce projet, une attention particulière est portée aux images uploadées par les utilisateurs dans le cadre du pipeline OCR, car elles transitent entre plusieurs services et doivent être supprimées après traitement.

---

## 8. Journalisation et traçabilité

Les événements de sécurité doivent être journalisés, notamment :
- tentatives d’authentification,
- accès aux ressources sensibles,
- actions administratives,
- erreurs critiques.

Les logs doivent être :
- centralisés,
- protégés contre l’altération,
- exploitables pour l’audit et l’investigation.

Les outils envisagés pour la centralisation des logs sont Loki et Grafana, déployables nativement sur K3s. Le détail est disponible dans `S05-logs-audit.md`.


---

## 9. Conformité et protection de la vie privée

La plateforme est conçue pour respecter les principes de protection des données personnelles :
- minimisation des données collectées,
- limitation de la durée de conservation,
- droit à l’effacement,
- traçabilité des traitements.

Ces exigences sont détaillées dans `S04-rgpd-conformite.md`.

---

## 10. Évolutivité et amélioration continue

Les principes de sécurité définis dans ce document sont appelés à évoluer
en fonction :
- de l’évolution du projet,
- des nouvelles menaces identifiées,
- des retours d’audit et de tests.

Toute évolution significative devra être documentée et validée.

Cette démarche d'amélioration continue garantit que la sécurité 
de la plateforme reste adaptée à son niveau de maturité 
et aux menaces identifiées à chaque étape du projet.

---

## 11. Documents associés

- `S02-threat-model.md`
- `S03-api-security.md`
- `S04-rgpd-conformite.md`
- `S05-logs-audit.md`
- `A03-architecture-runtime.md`
- `D01-environnement.md`
- `D02-cicd.md`
