# Logs & Audit — CollectionR

## Sommaire

1. [Objectif](#1-objectif)  
2. [Principes généraux](#2-principes-généraux)  
3. [Types de logs](#3-types-de-logs)  
4. [Journalisation des erreurs](#4-journalisation-des-erreurs)  
5. [Architecture de journalisation](#5-architecture-de-journalisation)
6. [Sécurité des logs](#6-sécurité-des-logs)  
7. [Accès aux logs](#7-accès-aux-logs)  
8. [Conservation des logs](#8-conservation-des-logs)  
9. [Évolution future](#9-évolution-future)
10. [Documents associés](#10-documents-associés)

## 1. Objectif

Ce document définit la stratégie de journalisation et d’audit du projet.

L’objectif est de :

- détecter les incidents de sécurité
- assurer la traçabilité des actions
- faciliter l’analyse des incidents
- répondre aux exigences réglementaires (RGPD)

La stratégie couvre les logs applicatifs, les logs d’infrastructure et les logs d’audit.

---

## 2. Principes généraux

La journalisation repose sur les principes suivants :

- **Traçabilité :** les événements importants doivent 
  être enregistrés
- **Sécurité :** les logs ne doivent pas exposer 
  d'informations sensibles
- **Accessibilité :** les logs doivent être consultables 
  pour analyser un incident
- **Conservation limitée :** les logs sont conservés 
  uniquement pendant la durée nécessaire

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

#### Niveaux de journalisation

Les logs applicatifs utilisent différents niveaux de gravité afin de faciliter leur exploitation :

- **DEBUG** : informations détaillées pour le développement
- **INFO** : fonctionnement normal de l’application
- **WARN** : comportement anormal sans blocage
- **ERROR** : erreurs empêchant une action ou un traitement

Ces niveaux permettent de filtrer les logs selon le contexte (développement, production, analyse d’incident).

#### Structure des logs

Chaque log applicatif suit une structure standardisée afin de garantir sa lisibilité et son exploitation.

Un log contient généralement :

- un horodatage (timestamp)
- un niveau de gravité
- un message descriptif
- un identifiant de service (ex : API, worker)
- éventuellement un identifiant utilisateur anonymisé

Lorsque cela est possible, un identifiant de corrélation (correlation ID) peut être utilisé pour relier plusieurs logs appartenant à une même requête ou opération.

Cela permet de suivre le parcours d’une action utilisateur à travers plusieurs services.

---

### 3.2 Logs d’infrastructure

Les logs d’infrastructure concernent les composants techniques de la plateforme :

- K3s (cluster Kubernetes)
- base de données PostgreSQL
- Redis
- volumes partagés utilisés pour les traitements OCR

Ces logs permettent de détecter :

- problèmes système
- pannes de services
- erreurs réseau
- anomalies liées au stockage temporaire
- dégradation des performances des services techniques

#### Surveillance des composants critiques

Certains composants font l'objet d'une attention particulière 
en raison de leur impact direct sur la disponibilité et la 
sécurité du système.

Dans le cluster K3s, les logs d'infrastructure incluent 
également les événements Kubernetes suivants :
- les événements Kubernetes (kubectl get events) ;
- les logs des Pods système (CoreDNS, Traefik) ;
- les alertes de ressources (CPU, mémoire) par namespace.

**Redis**

Redis est utilisé pour des mécanismes techniques tels que le cache ou le rate limiting.

Les événements suivants doivent être journalisés :

- indisponibilité ou redémarrage du service Redis
- erreurs de connexion entre l’API et Redis
- anomalies de performance (temps de réponse anormal)
- saturation mémoire ou dépassement de capacité
- échec d’opérations critiques (ex : rate limiting)

**Volumes partagés (OCR)**

Les volumes partagés sont utilisés pour le stockage temporaire des fichiers liés aux traitements OCR.

Les événements suivants doivent être surveillés :

- erreurs d’écriture ou de lecture des fichiers
- échec de suppression des fichiers temporaires
- accumulation anormale de fichiers
- problèmes de permissions ou d’accès
- manque d’espace disque

Ces journaux contribuent à la détection rapide des incidents et à la mise en place d’actions correctives afin de garantir la continuité de service.

> **Note :** le volume partagé OCR est utilisé uniquement
> pour le transit de l'image brute entre le Backend et
> le Worker OCR. Le résultat du traitement est écrit
> directement en PostgreSQL — voir `A02-flux-techniques.md`
> section 5.

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

Chaque log inclut un horodatage et, lorsque pertinent, un identifiant utilisateur anonymisé afin de garantir la traçabilité sans exposer de données sensibles.

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
- tentatives d'accès non autorisées ;
- incidents techniques.

---

## 5. Architecture de journalisation

L'architecture de journalisation évolue en trois paliers, 
cohérents avec la progression de l'infrastructure K3s.

### 5.1 Court terme — K3s local

Les services produisent leurs logs via les flux standards :
- **stdout (standard output)** : messages de fonctionnement 
  normal (informations, résultats) ;
- **stderr (standard error)** : erreurs et anomalies rencontrées.

Les logs sont consultables via la commande kubectl logs 
directement sur le cluster K3s local. Cette approche est 
suffisante pour la phase de développement et de démonstration.

Une attention particulière est portée aux composants critiques :
Redis OCR, Redis TCG et les volumes partagés OCR. Les anomalies 
liées à leur disponibilité ou leur capacité doivent pouvoir 
être identifiées rapidement.

#### Format des logs

Les logs applicatifs sont générés en format structuré (JSON) 
afin de faciliter leur analyse :
- recherche plus efficace ;
- filtrage avancé par niveau ou par service ;
- compatibilité native avec Loki et Grafana.

### 5.2 Moyen terme — K3s VPS

Mise en place d'une stack de centralisation des logs :
- **Loki** : agrégation et indexation des logs ;
- **Grafana** : visualisation et recherche avancée ;
- **Promtail** : collecte des logs depuis les Pods K3s.

Cette stack est déployable nativement sur K3s via Helm.

### 5.3 Long terme — Production

- alertes automatiques via AlertManager sur les événements 
  critiques ;
- rétention des logs configurée selon les durées définies 
  en section 8 ;
- audit des accès aux logs tracé et journalisé.

---


## 6. Sécurité des logs

Afin de garantir la sécurité des journaux :

- les mots de passe ne sont jamais enregistrés
- les tokens d’authentification ne sont jamais stockés
- les données personnelles sont minimisées

Les logs doivent éviter toute exposition de données sensibles.

Les accès aux logs peuvent être tracés afin de détecter toute consultation ou manipulation non autorisée.

Ces règles s'appliquent à tous les environnements 
du projet et sont vérifiées lors des revues de code 
via les Pull Requests.

---

## 7. Accès aux logs

L’accès aux logs est restreint aux membres autorisés de l’équipe.

Les rôles sont répartis de la manière suivante :

- équipe Cloud / DevOps : logs d’infrastructure
- équipe Backend : logs applicatifs
- équipe sécurité : logs d’audit

Dans l'environnement K3s, l'accès aux logs est contrôlé 
via le RBAC Kubernetes. Chaque rôle dispose uniquement 
des permissions kubectl nécessaires à la consultation 
des logs de son périmètre.

Cette restriction permet d’éviter toute manipulation ou consultation non autorisée.

---

## 8. Conservation des logs

Les logs sont conservés pour une durée limitée afin de respecter le principe de minimisation des données.

Durée indicative :

- logs applicatifs : 30 jours
- logs d’audit : 90 jours
- logs d’infrastructure : 30 jours (ou selon contraintes techniques)

Ces durées pourront évoluer selon les besoins du projet.

---

## 9. Évolution future

Au-delà de l'architecture de journalisation définie en 
section 5, les évolutions suivantes sont envisagées :

- mise en place d'un système de corrélation des logs 
  entre les différents services pour faciliter 
  le diagnostic des incidents complexes ;
- intégration des logs de sécurité dans un SIEM 
  (Security Information and Event Management) 
  si le projet atteint un niveau de maturité suffisant ;
- révision des durées de conservation définies en 
  section 8 en fonction des retours d'usage et 
  des évolutions réglementaires RGPD.

## 10. Documents associés

- `S01-principes-securite.md`
- `S02-threat-model.md`
- `S03-api-security.md`
- `S04-rgpd-conformite.md`
- `A03-architecture-runtime.md`
- `D01-environnement.md`
- `D04-observabilite-slo.md`
