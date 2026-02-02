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
*(Ticket S2.2)*

---

## 3. Mesures de mitigation
*(Ticket S2.3)*

---

## 4. Hypothèses et alignement architecture
*(Ticket S2.4)*

---

## Documents liés
- `01-principes-securite.md`
- `03-api-security.md`
- `05-upload-security.md`
- `07-logging-audit.md`
