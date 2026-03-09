## API Sécurité

### Sommaire

1. [Objectif](#1-objectif)
2. [Périmètre](#2-périmètre)
3. [Principes généraux de sécurité](#3-principes-généraux-de-sécurité)
4. [Authentification & gestion des tokens](#4-authentification--gestion-des-tokens)
5. [Autorisation & RBAC](#5-autorisation--rbac)
6. [Protection contre les attaques courantes (OWASP)](#6-protection-contre-les-attaques-courantes-owasp-top-10)
7. [Rate Limiting & protection contre les abus](#7-rate-limiting--protection-contre-les-abus)
8. [Sécurité API Web vs Mobile](#8-sécurité-api-web-vs-mobile)
9. [Journalisation & monitoring](#9-journalisation--monitoring)
10. [Sécurité des environnements](#10-sécurité-des-environnements)
11. [Évolution future](#11-évolution-future)


---

### 1. Objectif

Ce document définit les exigences de sécurité applicables aux API exposées par la plateforme ESP.

L’objectif est de prévenir :

- Les abus d’utilisation (spam, surcharge, scraping)
- Les intrusions et élévations de privilèges
- Les fuites de données
- Les attaques courantes identifiées par l’OWASP Top 10

Ces exigences s’appliquent à toutes les API backend accessibles depuis le web ou l’application mobile.

---

### 2. Périmètre

Ce document couvre la sécurité de l’API applicative exposée aux clients :

- application web
- application mobile

L’API applicative constitue le **point d’entrée unique** vers les services backend.

Les traitements internes (ex : analyse IA, traitements asynchrones) ne sont pas exposés directement aux clients et sont considérés comme **hors périmètre de ce document**.

L’API applicative interagit principalement avec la **base de données applicative**, qui contient les données métier et les informations des utilisateurs.

Les traitements liés à l’analyse et aux modèles IA peuvent utiliser une **base de données dédiée**, isolée de la base applicative, afin de garantir une séparation des responsabilités et une meilleure sécurité des données.

---

### 3. Principes généraux de sécurité

La sécurité repose sur les principes suivants :

- **Zero Trust** : aucune requête n’est considérée comme sûre par défaut.
- **Validation côté serveur uniquement** : le frontend ne constitue jamais une barrière de sécurité.
- **Moindre privilège (Least Privilege)** : chaque utilisateur ne peut accéder qu’aux ressources strictement nécessaires.
- **Séparation des environnements** : dev, staging et production sont isolés.

Ces principes sont appliqués à l’ensemble des endpoints exposés par l’API.

---

### 4. Authentification & gestion des tokens

L’API constitue le point d’entrée unique vers les services backend
et la base de données applicative.

#### 4.1 Exigences

- Toute action sensible nécessite une authentification.
- Les mots de passe sont hashés avec un algorithme sécurisé (bcrypt ou Argon2).
- Les tokens d’accès sont signés et ont une durée de vie limitée.
- Les clés de signature sont stockées de manière sécurisée (Secret Manager / variables protégées).

#### 4.2 Mécanisme retenu

- Authentification basée sur **JWT (JSON Web Token)**.
- **Access Token** : durée courte (ex : 15 minutes).
- **Refresh Token** : durée plus longue (ex : 7 jours).
- Rotation possible des clés de signature.

#### 4.3 Stockage des tokens

- 🌐 Web : cookies HttpOnly + Secure

- 📱 Mobile : stockage sécurisé (Secure Storage / Keychain)

Aucun token ne doit être stocké en localStorage.

---
### 5. Autorisation & RBAC (Role-Based Access Control)

Les contrôles de sécurité décrits dans cette section
découlent directement des menaces identifiées dans le
threat model de la plateforme.

#### 5.1 Exigences

- Chaque utilisateur possède un rôle.
- Les rôles définissent les permissions autorisées.
-Les vérifications sont effectuées côté backend via middleware.

#### 5.2 Rôles envisagés

- ```USER```
- ```ADMIN```
- ```MODERATOR``` (*si marketplace activée*)

#### 5.3 Protection contre l’IDOR

L’accès aux ressources est systématiquement vérifié :

- Un utilisateur ne peut consulter/modifier que ses propres collections.
- Les identifiants d’objets sont toujours validés côté serveur.

--- 
### 6. Protection contre les attaques courantes (OWASP Top 10)

La plateforme prend en compte les principales menaces :

#### 6.1 Injection (SQL / NoSQL)

- Utilisation d’ORM ou requêtes paramétrées.
- Aucune concaténation dynamique non contrôlée.

### 6.2 Broken Authentication

- Durée de vie courte des tokens.
- Invalidation possible des sessions.
- Limitation des tentatives de connexion.

#### 6.3 Sensitive Data Exposure

- Chiffrement TLS obligatoire (HTTPS).
- Données sensibles non exposées dans les logs.
- Sauvegardes chiffrées.

#### 6.4 XSS

- Validation et nettoyage des entrées utilisateur.
- Protection côté frontend via frameworks sécurisés.

#### 6.5 CSRF (Web)

- Si utilisation de cookies → protection CSRF activée.

---
### 7. Rate Limiting & Protection contre les abus

Afin de prévenir la surcharge et les abus :

- Limitation du nombre de requêtes par IP.
- Limitation spécifique sur endpoints sensibles :

    - ```/login```

    - ```/register```

    - ```/scan```

- Blocage temporaire en cas de dépassement.
- Journalisation des tentatives suspectes.

Dans le cas de traitements IA coûteux, des quotas par utilisateur peuvent être appliqués afin de maîtriser la charge et les coûts.

---

### 8. Sécurité API Web vs Mobile
#### 8.1 Web
                
- Cookies HttpOnly
- CORS strictement configuré
- Protection CSRF si nécessaire

#### 8.2 Mobile

- -Stockage sécurisé des tokens
- Aucune clé API embarquée en clair
- Validation stricte TLS

---
### 9. Journalisation & Monitoring

- Logs des tentatives de connexion
- Logs des erreurs 401 / 403
- Détection d’anomalies (pics inhabituels)
- Conservation des logs selon politique définie

Les logs ne doivent contenir aucune donnée sensible (mots de passe, tokens, données personnelles).

--- 
### 10. Sécurité des environnements

- Variables sensibles stockées via Secret Manager.
- Aucune clé ou secret dans le code source.
- Environnements séparés (dev/staging/prod).
- Accès restreint aux ressources cloud via IAM.

---
### 11. Évolution future

En cas de montée en charge ou d’ouverture publique importante :
- Mise en place d’un WAF (Web Application Firewall).
- Détection avancée d’abus.
- Surveillance automatisée des comportements anormaux.