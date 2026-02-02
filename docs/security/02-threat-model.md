# Threat Model — Plateforme

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
>L'analyse couvre à a fois les menaces techniques et les abus métier liés à l'usage de la plateforme.

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
- interception ou altération des flux entre services internes,
- appels non autorisés aux services internes,
- exposition involontaire de composants non destinés au public,
- mauvaise isolation entre environnements.


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

## 4. Hypothèses et alignement architecture
*(Ticket S2.4)*

---

## Documents liés
- `01-principes-securite.md`
- `03-api-security.md`
- `05-upload-security.md`
- `07-logging-audit.md`
