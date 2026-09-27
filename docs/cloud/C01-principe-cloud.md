# Principe cloud

## Sommaire

1. [Introduction](#1-introduction)
2. [Principes d'Architecture](#2-principes-darchitecture)
   * [2.1 Disponibilité](#21-disponibilité)
   * [2.2 Scalabilité](#22-scalabilité)
   * [2.3 Résilience et isolation](#23-résilience-et-isolation)
3. [DevOps et Infrastructure](#3-devops-et-infrastructure)
   * [3.1 Stack technique](#31-stack-technique)
   * [3.2 Automatisation](#32-automatisation)
   * [3.3 Bonnes pratiques Cloud](#33-bonnes-pratiques-cloud)
4. [Gouvernance et Sécurité](#4-gouvernance-et-sécurité)
   * [4.1 Organisation des rôles et IAM](#41-organisation-des-rôles-et-iam)
   * [4.2 Sécurité des données et Vie privée](#42-sécurité-des-données-et-vie-privée)
5. [Déploiement automatique (CI/CD) et Traçabilité](#5-déploiement-automatique-cicd-et-traçabilité)
6. [Conclusion](#6-conclusion)
7. [Documents associés](#7-documents-associés)


-----

## 1. Introduction

Ce document explique comment le projet **Collectionr** est construit et organisé.

Le projet est développé par une équipe de 9 étudiants et a pour objectif de proposer une application fiable pour les collectionneurs de cartes (TCG), tout en respectant une contrainte importante.

---

## 2. Principes d’Architecture

### 2.1 Disponibilité

L’objectif n’est pas d’avoir une infrastructure parfaite, mais une application stable et fonctionnelle.

- Les services redémarrent automatiquement en cas de problème (auto-restart)
- Le système est surveillé pour réagir rapidement en cas de panne

Résultat :  
L’application reste utilisable même en cas de bug ou de crash.

---

### 2.2 Scalabilité 

L’application est conçue pour pouvoir gérer plus d’utilisateurs si besoin.

- **Frontend / Backend** : peuvent être dupliqués facilement si le trafic augmente  
- **Base de données** : optimisée pour gérer beaucoup de données sans complexité inutile  

Résultat :  
L’application peut évoluer sans tout reconstruire.

---

### 2.3 Résilience et isolation

On évite qu’un problème casse tout le système.

- Les tâches lourdes (IA, scraping) passent par une file d’attente (Redis)  
- Si un service tombe, les données ne sont pas perdues  
- Les fichiers lourds (images) sont séparés de la base de données  

Résultat :  
Un problème reste localisé et n’impacte pas toute l’application.

---

## 3. DevOps et Infrastructure

### 3.1 Stack technique

Le projet utilise des technologies simples et connues :

| Partie | Technologie |
|-------|------------|
| Frontend | React / React Native + TypeScript |
| Backend | Node.js / NestJS |
| Intelligence Artificielle | Python (OpenCV, YOLO) |
| Données | PostgreSQL + Redis |
| Orchestration | K3s |
| File d'attente | Redis |
| Stockage | Volumes persistants |
| Gestion des secrets | Kubernetes Secrets (dev/staging) → Vault (production) |
| CI/CD | GitHub Actions |
| Observabilité | Prometheus + Grafana + Loki + Promtail |
| Workers | Python (OCR, TCG, Grading IA) |

Le projet part directement sur K3s comme orchestrateur principal. Docker est utilisé uniquement pour construire les images des services. Docker Compose peut éventuellement servir au debug ponctuel d'un service isolé mais ne fait pas partie de l'architecture cible.

---

### 3.2 Automatisation

On automatise le maximum pour éviter les erreurs humaines.

- **GitHub Actions** : lance les tests et prépare le code automatiquement  
- **kubectl + manifests K3s versionnés** : l'infrastructure
  est définie et reproductible via les manifests Kubernetes
  stockés dans Git. Terraform sera évalué lors de la phase
  de réalisation si un déploiement cloud managé est envisagé.

Résultat :  
Le projet est reproductible et plus sécurisé.

---

### 3.3 Bonnes pratiques Cloud

Pour garantir la robustesse du système tout en conservant un coût de 0$ (Free Tier), les bonnes pratiques Cloud suivantes sont strictement documentées et appliquées par l'équipe d'infrastructure :
- **Infrastructure as Code (IaC)** : Définition de l'infrastructure par le code pour éviter toute configuration manuelle.
- **Séparation des environnements** : Isolation stricte entre les environnements de développement (Dev), de pré-production (Staging) et de Production.
- **Optimisation des coûts (FinOps)** : Suivi rigoureux des ressources pour maîtriser les coûts
d'hébergement (Hetzner ou Scaleway en staging et production,
coût zéro en développement local).
- **Observabilité** : Centralisation des logs et métriques pour une intervention proactive avant toute panne critique.

---

## 4. Gouvernance et Sécurité

### 4.1 Organisation des rôles et IAM

Le projet est divisé en deux parties :

- **Infrastructure** : s’occupe des serveurs et du déploiement  
- **Sécurité** : protège les accès et les données  

**Gestion des Identités et des Accès (IAM) :**
L'IAM (Identity and Access Management) est le cadre de sécurité
permettant de s'assurer que les bonnes personnes ont les accès
appropriés aux bonnes ressources technologiques.

- L'ensemble des accès au système, aux bases de données et aux
  serveurs est **nominatif** (un compte personnel par membre de
  l'équipe, aucun compte générique partagé).
- Application du principe de moindre privilège : chaque développeur
  ou ingénieur ne dispose que des droits strictement nécessaires
  à l'accomplissement de sa mission.

La gestion des accès au cluster K3s est définie via RBAC Kubernetes
— voir `A03-architecture-runtime.md` section 9.2.

Résultat :
Chaque équipe a un rôle clair, sécurisé et totalement traçable.

---

### 4.2 Sécurité des données et Vie privée

Afin de garantir la protection des utilisateurs et de l'infrastructure, plusieurs règles strictes sont appliquées. Elles reposent sur les standards de **Privacy by Design**, **Privacy by Default** et **Security by Design** :

- **Sécurité native (Security by Design)** : La sécurité n'est pas une surcouche ajoutée a posteriori. Elle est intégrée dès la conception de l'architecture logicielle et cloud (chiffrement systématique des flux via HTTPS/TLS, protection contre les failles OWASP, gestion sécurisée des secrets et des accès).
- **Protection proactive (Privacy by Design)** : Le respect de la vie privée est ancré techniquement dans le code et les bases de données dès le premier jour de développement.
- **Principe de minimisation** : Le système ne collecte, ne traite et ne conserve que les données strictement indispensables au fonctionnement de l'application (images temporaires pour le pipeline OCR, données d'authentification minimales).
- **Transparence et paramètres par défaut (Privacy by Default)** : L'utilisateur est informé de manière transparente sur l'usage de ses informations. Dès la création du compte, tous les paramètres de confidentialité sont configurés à leur niveau maximal par défaut.
- **Contrôle restrictif et traçabilité** : Les accès internes aux environnements sont limités au strict nécessaire (principe de moindre privilège) et l'ensemble des données sensibles est protégé et auditable.

**Résultat :**  
L'infrastructure logicielle et les données des collectionneurs sont protégées structurellement. Cette approche globale renforce la confiance, sécurise le système face aux cybermenaces et assure une stricte conformité réglementaire (RGPD).


---

## 5. Déploiement automatique (CI/CD) et Traçabilité

Le système déploie automatiquement les mises à jour :

1. Vérification du code (qualité et sécurité)  
2. Création des images de l’application  
3. Déploiement automatique sur le serveur  

**Traçabilité globale (Pull Requests) :**
Afin de prévenir les erreurs et d'assurer un suivi complet, **toute modification** sur le code source ou l'infrastructure doit obligatoirement faire l'objet d'une Pull Request (PR). Chaque PR doit être relue et validée par au moins un autre membre de l'équipe (processus de *Code Review*) avant d'être intégrée en production. 

Résultat :  
Les mises à jour sont rapides, fiables, sans erreur manuelle, et chaque évolution de l'application est vérifiée, tracée et réversible.

---

## 6. Conclusion

Cette architecture permet de :

- créer une application fiable   
- automatiser les tâches importantes  
- préparer une évolution future  

L'architecture repose dès le départ sur K3s, avec une évolution prévue vers K3s VPS puis Kubernetes managé si la plateforme dépasse plusieurs dizaines de milliers d'utilisateurs.

## 7. Documents associés

- `A00-overview.md`
- `A03-architecture-runtime.md`
- `C02-choix-solutions-cloud.md`
- `D01-environnement.md`
- `D02-cicd.md`
- `S01-principes-securite.md`
- `S04-rgpd-conformite.md`
