# 07 – Logs & Audit

## Sommaire

1. [Objectif](#1-objectif)  
2. [Principes généraux](#2-principes-généraux)  
3. [Types de logs](#3-types-de-logs)  
4. [Journalisation des erreurs](#4-journalisation-des-erreurs)  
5. [Architecture de journalisation](#5-architecture-de-journalisation-mvp)  
6. [Sécurité des logs](#6-sécurité-des-logs)  
7. [Accès aux logs](#7-accès-aux-logs)  
8. [Conservation des logs](#8-conservation-des-logs)  
9. [Évolution future](#9-évolution-future)

## 1. Objectif

Ce document définit la stratégie de journalisation et d’audit du projet ESP.

L’objectif est de :

- détecter les incidents de sécurité
- assurer la traçabilité des actions
- faciliter l’analyse des incidents
- répondre aux exigences réglementaires (RGPD)

La stratégie couvre les logs applicatifs, les logs d’infrastructure et les logs d’audit.

---

## 2. Principes généraux

La journalisation repose sur les principes suivants :

- **Traçabilité :** les événements importants doivent être enregistrés.
- **Sécurité :** les logs ne doivent pas exposer d’informations sensibles.
- **Accessibilité :** les logs doivent pouvoir être consultés pour analyser un incident.
- **Conservation limitée :** les logs sont conservés uniquement pendant la durée nécessaire.

---

## 3. Types de logs

### 3.1 Logs applicatifs

Les logs applicatifs sont générés par les services applicatifs :

- API backend Node.js
- workers Python

Ces logs permettent de suivre le fonctionnement normal de l’application.

Exemples d’événements journalisés :

- requêtes API
- erreurs applicatives
- lancement d’un traitement OCR
- résultat d’un traitement IA

---

### 3.2 Logs d’infrastructure

Les logs d’infrastructure concernent les composants techniques :

- Docker
- base de données PostgreSQL
- Redis

Ces logs permettent de détecter :

- problèmes système
- pannes de services
- erreurs réseau

---

### 3.3 Logs d’audit

Les logs d’audit enregistrent les actions sensibles réalisées par les utilisateurs.

Actions auditées :

- tentatives de connexion
- création de compte
- modification de mot de passe
- accès refusé (403)
- suppression de compte
- actions administratives

Ces logs permettent d’identifier les comportements suspects et de tracer les actions importantes.

---

## 4. Journalisation des erreurs

Les erreurs HTTP sont également enregistrées dans les logs.

Cela inclut notamment :

- erreurs client (4xx)
- erreurs serveur (5xx)

Exemples :

- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 500 Internal Server Error

La journalisation de ces erreurs permet de détecter :

- tentatives d’accès non autorisées
- comportements anormaux
- incidents techniques.

---

## 5. Architecture de journalisation (MVP)

Dans la phase MVP du projet, les logs sont générés par les conteneurs Docker.

Les services produisent leurs logs via les flux standards :

- stdout
- stderr

Les journaux peuvent être consultés via les outils Docker.

Cette approche est adaptée à une infrastructure simple basée sur Docker Compose.

---

## 6. Sécurité des logs

Afin de garantir la sécurité des journaux :

- les mots de passe ne sont jamais enregistrés
- les tokens d’authentification ne sont jamais stockés
- les données personnelles sont minimisées

Les logs doivent éviter toute exposition de données sensibles.

---

## 7. Accès aux logs

L’accès aux logs est restreint aux membres autorisés de l’équipe.

Les rôles sont répartis de la manière suivante :

- équipe Cloud / DevOps : logs d’infrastructure
- équipe Backend : logs applicatifs
- équipe sécurité : logs d’audit

Cette restriction permet d’éviter toute manipulation ou consultation non autorisée.

---

## 8. Conservation des logs

Les logs sont conservés pour une durée limitée afin de respecter le principe de minimisation des données.

Durée indicative :

- logs applicatifs : 30 jours
- logs d’audit : 90 jours

Ces durées pourront évoluer selon les besoins du projet.

---

## 9. Évolution future

Dans le cadre d’une évolution vers une infrastructure Kubernetes (K3s), une solution de centralisation des logs pourra être mise en place.

Exemples d’outils possibles :

- Grafana Loki
- ELK Stack

Ces outils permettront :

- une recherche centralisée dans les logs
- la détection d’incidents
- l’analyse avancée des événements.
