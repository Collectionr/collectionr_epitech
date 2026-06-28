## Sécurité des APIs — CollectionR

### Sommaire

1. [Objectif](#1-objectif)
2. [Périmètre](#2-périmètre)
3. [Principes généraux de sécurité](#3-principes-généraux-de-sécurité)
4. [Authentification & gestion des tokens](#4-authentification--gestion-des-tokens)
5. [Autorisation & RBAC](#5-autorisation--rbac)
6. [Protection contre les attaques courantes (OWASP)](#6-protection-contre-les-attaques-courantes-owasp-top-10)
7. [Rate Limiting & protection contre les abus](#7-rate-limiting--protection-contre-les-abus)
8. [Sécurité du volume partagé OCR](#8-sécurité-du-volume-partagé-ocr)
9. [Sécurité API Web vs Mobile](#9-sécurité-api-web-vs-mobile)
10. [Journalisation & monitoring](#10-journalisation--monitoring)
11. [Sécurité des environnements](#11-sécurité-des-environnements)
12. [Évolution future](#12-évolution-future)
13. [Documents associés](#13-documents-associés)

---

## 1. Objectif

Ce document définit les exigences de sécurité applicables aux API exposées par la plateforme CollectionR.

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

- toute action sensible nécessite une authentification
- les mots de passe sont hashés (bcrypt ou Argon2)
- les tokens sont signés et à durée de vie limitée
- les clés sont stockées de manière sécurisée (Secret Manager)

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

- chaque utilisateur possède un rôle
- les rôles définissent les permissions
- les contrôles sont effectués côté backend

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

L'OWASP (Open Web Application Security Project) est une 
organisation internationale qui publie une liste des dix 
failles de sécurité les plus critiques pour les applications 
web. Cette section détaille les mesures mises en place pour 
se protéger contre ces attaques dans le cadre de la 
plateforme CollectionR.

---

### 6.1 Injection (SQL / NoSQL)

**Qu'est-ce que c'est ?**
Une injection consiste à insérer du code malveillant dans 
une requête afin de manipuler la base de données ou 
d'accéder à des données non autorisées.

**Exemple concret :** un utilisateur malveillant tape 
`' OR 1=1 --` dans un champ de recherche pour récupérer 
toutes les données de la base.

**Mesures appliquées :**
- validation systématique côté serveur de toutes les entrées 
  provenant du client (type, format, longueur maximale, 
  valeurs autorisées) ;
- utilisation d'ORM ou de requêtes paramétrées ;
- aucune concaténation dynamique non contrôlée dans 
  les requêtes.

---

### 6.2 Broken Authentication (Authentification compromise)

**Qu'est-ce que c'est ?**
Une faille d'authentification permet à un attaquant de 
prendre le contrôle d'un compte utilisateur, par exemple 
en devinant un mot de passe ou en volant un token de session.

**Mesures appliquées :**
- durée de vie courte des tokens d'accès ;
- invalidation possible des sessions à tout moment ;
- limitation des tentatives de connexion (voir section 7).

---

### 6.3 Sensitive Data Exposure (Exposition de données sensibles)

**Qu'est-ce que c'est ?**
Des données sensibles (mots de passe, tokens, données 
personnelles) sont exposées involontairement, par exemple 
dans des logs, des réponses API ou des sauvegardes non 
chiffrées.

**Mesures appliquées :**
- chiffrement TLS obligatoire sur toutes les communications (HTTPS) ;
- données sensibles non exposées dans les logs ;
- sauvegardes chiffrées.

---

### 6.4 XSS — Cross-Site Scripting

**Qu'est-ce que c'est ?**
Une attaque XSS consiste à injecter du code JavaScript 
malveillant dans une page web afin qu'il soit exécuté 
par le navigateur d'un autre utilisateur. Cela peut 
permettre de voler des cookies, des tokens ou des données 
personnelles.

**Exemple concret :** un utilisateur malveillant entre 
`<script>alert('volé')</script>` dans un champ de 
commentaire. Si ce contenu est affiché sans nettoyage, 
le script s'exécute dans le navigateur des autres 
utilisateurs.

**Mesures appliquées :**
- validation et nettoyage de toutes les entrées utilisateur 
  avant affichage ;
- protection assurée par les frameworks frontend modernes 
  (React notamment) qui échappent automatiquement 
  le contenu affiché.

---

### 6.5 CSRF — Cross-Site Request Forgery

**Qu'est-ce que c'est ?**
Une attaque CSRF force le navigateur d'un utilisateur 
connecté à envoyer une requête non souhaitée à 
l'application, à son insu. Par exemple, cliquer sur 
un lien piégé pourrait déclencher une action sur son compte.

**Mesures appliquées :**
- protection CSRF activée lorsque des cookies sont utilisés 
  pour l'authentification ;
- non applicable pour les clients mobiles qui n'utilisent 
  pas de cookies.

---

### 6.6 Headers de sécurité HTTP

**Qu'est-ce que c'est ?**
Les headers HTTP sont des informations envoyées par le 
serveur au navigateur pour lui indiquer comment se 
comporter. Certains headers permettent de renforcer 
la sécurité côté client.

**Headers configurés :**

- **Content-Security-Policy (CSP)** : indique au navigateur 
  quelles sources de contenu sont autorisées, limitant 
  ainsi les risques d'injection de scripts malveillants ;
- **X-Content-Type-Options** : empêche le navigateur 
  d'interpréter un fichier différemment de ce que 
  le serveur indique ;
- **X-Frame-Options** : protège contre le clickjacking, 
  une technique qui consiste à superposer une page 
  invisible pour tromper l'utilisateur ;
- **Strict-Transport-Security (HSTS)** : force le navigateur 
  à toujours utiliser HTTPS, même si l'utilisateur 
  tape HTTP manuellement.

Ces mécanismes renforcent la sécurité côté navigateur 
sans nécessiter d'action de la part de l'utilisateur.

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

## 8. Sécurité du volume partagé OCR

Le traitement OCR repose sur un volume partagé utilisé pour l’échange temporaire de fichiers entre les services applicatifs.

Ce volume constitue un point sensible de l’architecture, car il est utilisé lors des opérations de scan déclenchées par l’API.

### 8.1 Isolation des accès

Le principe du moindre privilège s’applique à ce volume partagé :

- le backend dépose les fichiers nécessaires au traitement;
- le worker OCR lit les fichiers à traiter et écrit
les résultats directement en PostgreSQL —
le volume partagé ne sert qu'au transit de l'image brute ;
- les autres services n’ont pas accès à ce volume.

Les droits d’accès sont limités afin d’éviter toute lecture, modification ou suppression non autorisée.

Cette isolation est cohérente avec le principe de Zero Trust appliqué à l’ensemble de la plateforme.

### 8.2 Usage temporaire des fichiers

Les fichiers liés au traitement OCR sont conservés uniquement pendant la durée nécessaire au traitement.

Des mécanismes de nettoyage sont prévus afin de supprimer automatiquement les fichiers temporaires après traitement ou après expiration d’un délai court.

Cette approche permet de réduire :

- le risque d’exposition de données
- l’encombrement du stockage
- l’impact d’un incident de sécurité

### 8.3 Protection contre la saturation du stockage

Le point d’entrée `/scan` peut faire l’objet de limitations spécifiques afin d’éviter une saturation du disque ou une dégradation du service.

Les protections suivantes peuvent être appliquées :

- limitation du nombre de requêtes de scan par utilisateur ou par IP
- limitation de la taille maximale des fichiers envoyés
- quotas d’usage sur les traitements OCR
- suppression automatique des fichiers temporaires
- surveillance de l’espace disque disponible

Ces mesures permettent de limiter les risques de déni de service applicatif liés au stockage temporaire.

---

## 9. Sécurité API Web vs Mobile
### 9.1 Web

- Cookies HttpOnly
- CORS strictement configuré
- Protection CSRF si nécessaire

---

### 9.2 Mobile

- Stockage sécurisé des tokens
- Aucune clé API embarquée en clair
- Validation stricte TLS

---

## 10. Journalisation & Monitoring

La surveillance repose sur :

- les logs définis dans `S05-logs-audit.md`
- la détection d'événements critiques (ex : erreurs 401/403 répétées)
- la mise en place d'alertes automatiques via
  AlertManager — voir `D04-observabilite-slo.md` section 5.1

Les outils retenus sont Loki + Promtail pour la
centralisation des logs et Grafana pour la visualisation,
déployés nativement sur K3s — voir `D04-observabilite-slo.md`.

Ces mécanismes permettent d'identifier rapidement les incidents.

Aucune donnée sensible n'est présente dans les logs.

---

## 11. Sécurité des environnements

Les règles suivantes s'appliquent à tous les environnements 
du projet :

- variables sensibles injectées via les Secrets Kubernetes
en local et staging, avec évolution prévue vers Vault
en production — voir `D01-environnement.md` section 5.2
- aucune clé ou secret dans le code source ou les images Docker ;
- environnements dev, staging et production strictement isolés 
  via des namespaces Kubernetes distincts ;
- accès restreint aux ressources du cluster via RBAC Kubernetes.

---

## 12. Évolution future

Les mesures de sécurité API évoluent en parallèle 
de l'infrastructure :

**Court terme — K3s local**
- mise en place du rate limiting sur les endpoints critiques ;
- configuration des NetworkPolicies entre Pods ;
- gestion des secrets via Secrets Kubernetes.

**Moyen terme — K3s VPS**
- mise en place d'un Ingress Controller avec règles 
  de sécurité (Traefik ou Nginx) ;
- activation des alertes automatiques via AlertManager ;
- surveillance des comportements anormaux via Grafana.

**Long terme — Production**
- mise en place d'un WAF (Web Application Firewall) ;
- détection avancée des abus ;
- audit de sécurité externe recommandé avant ouverture publique.

---

## 13. Documents associés

- `S01-principes-securite.md`
- `S02-threat-model.md`
- `S05-logs-audit.md`
- `S06-reseaux-iam.md`
- `A02-flux-techniques.md`
- `A03-architecture-runtime.md`
- `D01-environnement.md`
- `D04-observabilite-slo.md`
