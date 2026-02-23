## 04 – API Security


### 1. Objectif

Ce document définit les exigences de sécurité applicables aux API exposées par la plateforme ESP.
L’objectif est de prévenir :

- Les abus d’utilisation (spam, surcharge, scraping)
- Les intrusions et élévations de privilèges
- Les fuites de données
- Les attaques courantes identifiées par l’OWASP Top 10

Ces exigences s’appliquent à toutes les API backend accessibles depuis le web ou l’application mobile.

---
### 2. Principes généraux de sécurité

La sécurité repose sur les principes suivants :

- **Zero Trust** : aucune requête n’est considérée comme sûre par défaut.
- **Validation côté serveur uniquement** : le frontend ne constitue jamais une barrière de sécurité.
- **Moindre privilège (Least Privilege)** : chaque utilisateur ne peut accéder qu’aux ressources strictement nécessaires.
- **Séparation des environnements** : dev, staging et production sont isolés.

---
### 3. Authentification & gestion des tokens
#### 3.1 Exigences

- Toute action sensible nécessite une authentification.
- Les mots de passe sont hashés avec un algorithme sécurisé (bcrypt ou Argon2).
- Les tokens d’accès sont signés et ont une durée de vie limitée.
- Les clés de signature sont stockées de manière sécurisée (Secret Manager / variables protégées).

#### 3.2 Mécanisme retenu

- Authentification basée sur **JWT (JSON Web Token)**.
- **Access Token** : durée courte (ex : 15 minutes).
- **Refresh Token** : durée plus longue (ex : 7 jours).
- Rotation possible des clés de signature.

#### 3.3 Stockage des tokens

- 🌐 Web : cookies HttpOnly + Secure

- 📱 Mobile : stockage sécurisé (Secure Storage / Keychain)

Aucun token ne doit être stocké en localStorage.

---
### 4. Autorisation & RBAC (Role-Based Access Control)
#### 4.1 Exigences

- Chaque utilisateur possède un rôle.
- Les rôles définissent les permissions autorisées.
-Les vérifications sont effectuées côté backend via middleware.

#### 4.2 Rôles envisagés

- ```USER```

- ```ADMIN```
- ```MODERATOR``` (*si marketplace activée*)

#### 4.3 Protection contre l’IDOR

L’accès aux ressources est systématiquement vérifié :

- Un utilisateur ne peut consulter/modifier que ses propres collections.
- Les identifiants d’objets sont toujours validés côté serveur.

--- 
### 5. Protection contre les attaques courantes (OWASP Top 10)

La plateforme prend en compte les principales menaces :

#### 5.1 Injection (SQL / NoSQL)

- Utilisation d’ORM ou requêtes paramétrées.
- Aucune concaténation dynamique non contrôlée.

### 5.2 Broken Authentication

- Durée de vie courte des tokens.
- Invalidation possible des sessions.
- Limitation des tentatives de connexion.

#### 5.3 Sensitive Data Exposure

- Chiffrement TLS obligatoire (HTTPS).
- Données sensibles non exposées dans les logs.
- Sauvegardes chiffrées.

#### 5.4 XSS

- Validation et nettoyage des entrées utilisateur.
- Protection côté frontend via frameworks sécurisés.

#### 5.5 CSRF (Web)

- Si utilisation de cookies → protection CSRF activée.

---
### 6. Rate Limiting & Protection contre les abus

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

### 7. Sécurité API Web vs Mobile
#### 7.1 Web
                
- Cookies HttpOnly
- CORS strictement configuré
- Protection CSRF si nécessaire

#### 7.2 Mobile

- -Stockage sécurisé des tokens
- Aucune clé API embarquée en clair
- Validation stricte TLS

---
### 8. Journalisation & Monitoring

- Logs des tentatives de connexion
- Logs des erreurs 401 / 403
- Détection d’anomalies (pics inhabituels)
- Conservation des logs selon politique définie

Les logs ne doivent contenir aucune donnée sensible (mots de passe, tokens, données personnelles).

--- 
### 9. Sécurité des environnements

- Variables sensibles stockées via Secret Manager.
- Aucune clé ou secret dans le code source.
- Environnements séparés (dev/staging/prod).
- Accès restreint aux ressources cloud via IAM.

---
### 10. Évolution future

En cas de montée en charge ou d’ouverture publique importante :
- Mise en place d’un WAF (Web Application Firewall).
- Détection avancée d’abus.
- Surveillance automatisée des comportements anormaux.