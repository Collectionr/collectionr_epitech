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

## 1. Objectif

Ce document définit les exigences de sécurité applicables aux API exposées par la plateforme ESP.

L’objectif est de prévenir :

- Les abus d’utilisation (spam, surcharge, scraping)
- Les intrusions et élévations de privilèges
- Les fuites de données
- Les attaques courantes identifiées par l’OWASP Top 10 (référentiel des principales failles de sécurité applicatives)

Ces exigences s’appliquent à toutes les API backend accessibles depuis le web ou l’application mobile.

---

## 2. Périmètre

Ce document couvre la sécurité de l’API applicative exposée aux clients :

- application web
- application mobile

L’API applicative constitue le **point d’entrée unique** vers les services backend.

Les traitements internes (ex : analyse IA, traitements asynchrones) ne sont pas exposés directement aux clients et sont considérés comme **hors périmètre**.

L’API interagit avec :

- la base de données applicative (données utilisateurs et métier)
- éventuellement une base dédiée aux traitements IA, isolée pour des raisons de sécurité et de séparation des responsabilités

---

## 3. Principes généraux de sécurité

La sécurité repose sur les principes suivants :

- **Zero Trust** : aucune requête n’est considérée comme sûre par défaut
- **Validation côté serveur obligatoire** : toutes les entrées sont validées côté backend
- **Le frontend ne constitue pas une barrière de sécurité**
- **Authentification et autorisation systématiques**
- **Moindre privilège (Least Privilege)**
- **Séparation des environnements (dev, staging, production)**
- **Protection contre les abus (rate limiting)**
- **Journalisation et traçabilité des événements sensibles**

Ces principes sont appliqués à l’ensemble des endpoints.

---

## 4. Authentification & gestion des tokens

### 4.1 Exigences

- Toute action sensible nécessite une authentification
- Les mots de passe sont hashés (bcrypt ou Argon2)
- Les tokens sont signés et à durée de vie limitée
- Les clés sont stockées de manière sécurisée (Secret Manager)

---

### 4.2 Mécanisme retenu

- Authentification basée sur **JWT (JSON Web Token)**
- **Access Token** : courte durée (ex : 15 minutes)
- **Refresh Token** : durée plus longue (ex : 7 jours)

Une stratégie de gestion des tokens est mise en place :

- révocation des refresh tokens côté serveur (blacklist ou stockage en base)
- rotation des refresh tokens pour limiter les risques de compromission
- invalidation du refresh token lors de la déconnexion
- rotation possible des clés de signature

---

### 4.3 Stockage des tokens

- 🌐 Web : cookies HttpOnly + Secure
- 📱 Mobile : stockage sécurisé (Secure Storage / Keychain)

Aucun token n’est stocké en localStorage.

---

## 5. Autorisation & RBAC (Role-Based Access Control)

### 5.1 Exigences

- Chaque utilisateur possède un rôle
- Les rôles définissent les permissions
- Les contrôles sont effectués côté backend

---

### 5.2 Rôles envisagés

- `USER`
- `ADMIN`
- `MODERATOR` (optionnel)

---

### 5.3 Protection contre l’IDOR

La vérification de propriété (ownership) est réalisée côté backend via des contrôles centralisés (middlewares ou services dédiés).

Chaque accès à une ressource vérifie que :

- l’utilisateur est propriétaire de la ressource
- ou possède les droits nécessaires

Cette approche centralisée limite les risques d’oubli lors de l’implémentation.

Les identifiants sont systématiquement validés côté serveur.

---

## 6. Protection contre les attaques courantes (OWASP Top 10)

### 6.1 Injection (SQL / NoSQL)

- Validation systématique côté serveur de toutes les entrées provenant du client (type, format, longueur maximale, valeurs autorisées).
- Utilisation d’ORM ou de requêtes paramétrées.
- Aucune concaténation dynamique non contrôlée dans les requêtes.

---

### 6.2 Broken Authentication

- Durée de vie courte des tokens
- Invalidation possible des sessions
- Limitation des tentatives de connexion

---

### 6.3 Sensitive Data Exposure

- Chiffrement TLS obligatoire (HTTPS)
- Données sensibles non exposées dans les logs
- Sauvegardes chiffrées.

---

### 6.4 XSS

- Validation et nettoyage des entrées utilisateur
- Protection via frameworks frontend

---

#### 6.5 CSRF (Web)

- protection activée si cookies utilisés

---

#### 6.6 Headers de sécurité HTTP

Des headers de sécurité sont configurés afin de renforcer la protection côté client :

- **Content-Security-Policy (CSP)** : limite les sources de contenu autorisées
- **X-Content-Type-Options** : empêche l’interprétation incorrecte des fichiers
- **X-Frame-Options** : protège contre le clickjacking
- **Strict-Transport-Security (HSTS)** : force l’utilisation de HTTPS

Ces mécanismes renforcent la sécurité côté navigateur.

---

## 7. Rate Limiting & Protection contre les abus

Des mécanismes de limitation sont mis en place :

- limitation du nombre de requêtes par IP
- protection spécifique des endpoints sensibles :
  - `/login`
  - `/register`
  - `/scan`

Des seuils indicatifs sont définis :

- `/login` : 5 tentatives / minute → blocage temporaire (ex : 15 minutes)
- `/register` : limitation par IP
- `/scan` : quota par utilisateur

Les tentatives suspectes sont journalisées.

Ces valeurs pourront évoluer.

---

## 8. Sécurité API Web vs Mobile
### 8.1 Web

- Cookies HttpOnly
- CORS strictement configuré
- Protection CSRF si nécessaire

---

### 8.2 Mobile

- Stockage sécurisé des tokens
- Aucune clé API embarquée en clair
- Validation stricte TLS

---

## 9. Journalisation & Monitoring

La surveillance repose sur :

- les logs définis dans le document "Logs & Audit"
- la détection d’événements critiques (ex : erreurs 401/403 répétées)
- la mise en place possible d’alertes automatiques (ex : Sentry)

Ces mécanismes permettent d’identifier rapidement les incidents.

Aucune donnée sensible n’est présente dans les logs.

---

## 10. Sécurité des environnements

- Variables sensibles stockées via Secret Manager
- Aucune clé ou secret dans le code source
- Environnements isolés
- Accès restreint aux ressources cloud via IAM

---
## 11. Évolution future

En cas de montée en charge ou d’ouverture publique importante :
- Mise en place d’un WAF (Web Application Firewall).
- Détection avancée d’abus.
- Surveillance automatisée des comportements anormaux.