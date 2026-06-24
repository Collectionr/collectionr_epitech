# Threat Model — Plateforme

## Sommaire

1. [Actifs critiques et périmètre de sécurité](#1-actifs-critiques-et-périmètre-de-sécurité)
   - [1.1 Actifs critiques](#11-actifs-critiques)
   - [1.2 Flux et composants couverts](#12-flux-et-composants-couverts)
   - [1.3 Éléments hors périmètre](#13-éléments-hors-périmètre)
2. [Menaces identifiées](#2-menaces-identifiées)
   - [2.1 Menaces techniques](#21-menaces-techniques)
   - [2.2 Abus métier](#22-abus-métier)
   - [2.3 Menaces liées aux flux](#23-menaces-liées-aux-flux)
3. [Mesures de mitigation](#3-mesures-de-mitigation)
   - [3.1 Mitigations des menaces techniques](#31-mitigations-des-menaces-techniques)
   - [3.2 Mitigations des abus métier](#32-mitigations-des-abus-métier)
   - [3.3 Mitigations liées aux flux](#33-mitigations-liées-aux-flux)
   - [3.4 Mitigations spécifiques à l'orchestration K3s](#34-mitigations-spécifiques-à-lorchestration-k3s)
4. [Hypothèses et alignement architecture](#4-hypothèses-et-alignement-architecture)
   - [4.1 Dépendances et liens avec l'architecture](#41-dépendances-et-liens-avec-larchitecture)
   - [4.2 Validation croisée](#42-validation-croisée)
5. [Évolution future](#5-évolution-future)
6. [Documents liés](#6-documents-liés)

## Objectif du document
Ce document présente le **threat model de la plateforme**, c’est-à-dire
l’identification des actifs critiques, des menaces potentielles et des mesures
de sécurité associées.

Il s’inscrit dans une démarche **Security by Design** et sert de référence pour :
- la sécurité des APIs,
- la sécurisation des flux techniques,
- la définition des contrôles Cloud & DevOps,
- la conformité réglementaire.

---

## Périmètre
Le threat model couvre les composants suivants :
- API exposée aux clients web et mobile
- Backend applicatif
- Services internes (traitements asynchrones / IA)
- Base de données
- Flux de données et traitements
- Environnements cloud et pipeline CI/CD (niveau conceptuel)

Les aspects purement UX/UI et les détails algorithmiques internes sont hors périmètre.

---

## Méthodologie
L’analyse s’appuie sur :
- l’identification des **actifs critiques**,
- l’analyse des menaces techniques (inspirée de STRIDE),
- l’identification des abus métier,
- la définition de **mesures de mitigation** adaptées à l’architecture cloud.
---
### Logique de l’analyse de sécurité

Le threat model est structuré selon la logique suivante :

1. Identifier les **actifs critiques** de la plateforme  
2. Analyser les **menaces** pesant sur ces actifs
3. Définir des **mesures de mitigation** adaptées  
4. Vérifier l’**alignement avec l’architecture cloud et backend**

Cette approche permet de garantir une analyse progressive, cohérente
et directement exploitable par les équipes d’architecture et de sécurité.

---
### Référentiel d’analyse des menaces (STRIDE)

Pour structurer l’identification des menaces, le threat model s’appuie
sur le référentiel **STRIDE**, couramment utilisé en architecture et
en cybersécurité.

STRIDE permet de classifier les menaces selon six grandes catégories :

- **Spoofing** : usurpation d’identité ou contournement de l’authentification
- **Tampering** : modification non autorisée des données ou des flux
- **Repudiation** : impossibilité de tracer ou d’attribuer une action
- **Information Disclosure** : exposition ou fuite d’informations sensibles
- **Denial of Service** : indisponibilité ou dégradation du service
- **Elevation of Privilege** : obtention de privilèges supérieurs aux droits accordés

Ce référentiel est utilisé comme une **grille de lecture** afin de garantir
une couverture complète des menaces techniques, sans imposer de solutions
techniques spécifiques.


---

## 1. Actifs critiques et périmètre de sécurité

> Cette section identifie ce qui doit être protégé et définit les frontières
> de l’analyse de sécurité.

### 1.1 Actifs critiques
| Actif | Description | Niveau de sensibilité |
|------|------------|----------------------|
| Comptes utilisateurs | Identité et informations des utilisateurs | Élevé |
| Données de collection | Cartes possédées et métadonnées | Élevé |
| Images uploadées | Photos des cartes envoyées par les utilisateurs | Élevé |
| Tokens d’authentification | Jetons d’accès aux APIs | Critique |
| Résultats de traitement | Résultats de pré-analyse et de scoring | Moyen |
| Logs et audit | Traces d’accès et d’actions sensibles | Élevé |
| Secrets et clés API | Credentials d'accès aux services externes | Critique |
| Volume partagé OCR | Fichiers temporaires du pipeline de scan | Élevé |


---

### 1.2 Flux et composants couverts
Le threat model couvre notamment :
- les appels API effectués par les clients web et mobile,
- les flux d’authentification et de gestion des sessions,
- les flux d’upload de fichiers et leur traitement,
- les traitements asynchrones internes,
- les accès à la base de données,
- les interactions entre services internes.

---

### 1.3 Éléments hors périmètre
Les éléments suivants ne sont pas couverts par ce threat model :
- les choix d’interface utilisateur (UX/UI),
- les détails internes des algorithmes de traitement,
- les optimisations de performance purement applicatives.


---

## 2. Menaces identifiées
>Cette section identifie les principales menaces pesant sur les actifs critiques de la plateforme.
>L'analyse couvre à la fois les menaces techniques et les abus métier liés à l'usage de la plateforme.

### 2.1 Menaces techniques

Les menaces techniques suivantes ont été identifiées :

| Catégorie | Menace | Actifs concernés |
|----------|--------|------------------|
| Spoofing | Usurpation d’identité via vol de token | Comptes, API |
| Tampering | Modification non autorisée des données | Données de collection |
| Repudiation | Actions non traçables ou non auditées | Logs, audit |
| Information Disclosure | Fuite de données sensibles | Données personnelles |
| Denial of Service | Saturation API ou services IA | API, traitements |
| Elevation of Privilege | Contournement des rôles et permissions | Comptes, données |
| Denial of Service | Saturation API ou services IA | API /scan, Worker OCR, Redis OCR |

---
### 2.2 Abus métier

Au-delà des attaques techniques, plusieurs scénarios d’abus métier
ont été identifiés :

- Scraping massif de données via appels API répétés
- Upload abusif de fichiers volumineux pour saturer le stockage
- Contournement des limites d’utilisation (quotas, fréquence)
- Tentatives d’accès aux collections d’autres utilisateurs
- Exploitation des traitements automatisés à des fins non prévues

---
### 2.3 Menaces liées aux flux

Les flux inter-composants présentent également des risques spécifiques :
- interception ou altération des flux entre services internes ;
- appels non autorisés aux services internes ;
- exposition involontaire de composants non destinés au public ;
- mauvaise isolation entre environnements ;
- accès non autorisé à l'API server K3s ;
- mauvaise configuration des NetworkPolicies exposant 
  des services internes ;
- secret Kubernetes lisible par un Pod non autorisé.


---

## 3. Mesures de mitigation
>Cette section présente les mesures de sécurité permettant de réduire
>les risques identifiés lors de l’analyse des menaces. Ces mesures sont
>définies au niveau de l’architecture et des principes de sécurité,
>sans détailler les implémentations techniques.

### 3.1 Mitigations des menaces techniques

| Menace | Mesures de mitigation |
|------|-----------------------|
| Usurpation d’identité | Authentification forte, gestion sécurisée des tokens |
| Altération des données | Contrôles d’accès, validation des entrées |
| Absence de traçabilité | Journalisation des actions sensibles |
| Fuite de données | Chiffrement des données, contrôle des accès |
| Déni de service | Rate limiting, quotas, protection anti-abus |
| Élévation de privilèges | Gestion stricte des rôles et permissions |

---
### 3.2 Mitigations des abus métier

Les abus métier identifiés sont atténués par les mesures suivantes :
- limitation du nombre d’appels API et des quotas d’utilisation,
- contrôles sur les flux d’upload (taille, fréquence),
- isolation des données par utilisateur,
- surveillance des usages anormaux.

---

### 3.3 Mitigations liées aux flux

Les flux inter-composants sont sécurisés par :
- une segmentation réseau claire entre les composants,
- l’absence d’exposition directe des services internes,
- des contrôles d’accès inter-services,
- une gestion sécurisée des secrets.

---
### 3.4 Mitigations spécifiques à l'orchestration K3s

L'utilisation de K3s comme orchestrateur introduit des 
vecteurs d'attaque spécifiques, couverts par les mesures 
suivantes :

| Menace | Mesure de mitigation |
|---|---|
| Accès non autorisé au cluster | RBAC Kubernetes strict par namespace |
| Communication inter-Pods non sécurisée | NetworkPolicies limitant les flux entre services |
| Secret exposé dans les manifests | Secrets Kubernetes, évolution vers Vault/Doppler |
| Conteneur privilégié compromis | Interdiction du mode privilégié sauf justification |
| Accès au plan de contrôle K3s | Accès restreint au kubeconfig et à l'API server |

---

## 4. Hypothèses et alignement architecture
Le présent threat model repose sur les hypothèses d’architecture suivantes :
- l'API est exposée uniquement via le backend applicatif,
- les services de traitement internes ne sont pas exposés publiquement,
- la base de données est isolée dans une zone réseau privée,
- les accès sont contrôlés via des rôles et permissions,
- les traitements lourds sont exécutés de manière asynchrone,
- l'orchestration repose sur K3s avec isolation des services 
  via namespaces et NetworkPolicies,
- aucun secret n'est stocké en clair dans les manifests 
  Kubernetes ou le dépôt Git.

### 4.1 Dépendances et liens avec l’architecture

Le threat model est étroitement lié aux éléments suivants :
- architecture logique de la plateforme,
- définition des flux techniques,
- politique de sécurité des APIs,
- configuration réseau et IAM,
- pipeline CI/CD et contrôles qualité.

Toute évolution majeure de ces éléments devra entraîner une révision
du threat model.

---

### 4.2 Validation croisée

Le threat model fait l’objet d’une relecture croisée avec les responsables
Cloud et Backend afin de garantir la cohérence entre les hypothèses de
sécurité et les choix d’architecture.

---

## 5. Évolution future

Ce threat model sera mis à jour à chaque étape 
de l'évolution de l'infrastructure :

- **Court terme** : validation des mitigations K3s 
  local et tests de sécurité basiques.
- **Moyen terme** : audit des NetworkPolicies et 
  des RBAC en environnement VPS, intégration des 
  alertes de sécurité via AlertManager.
- **Long terme** : audit de sécurité externe recommandé 
  avant ouverture publique, revue complète du threat 
  model avant passage en Kubernetes managé.

---

## 6. Documents liés
- `01-principes-securite.md`
- `03-api-security.md`
- `05-upload-security.md`
- `07-logs-audit.md`
