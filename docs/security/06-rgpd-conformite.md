# RGPD & Conformité

## Sommaire

## Sommaire

1. [Objectif et responsable de traitement](#1-objectif-et-responsable-de-traitement)
2. [Données collectées](#2-données-collectées)
   - 2.1 Données d'identification
   - 2.2 Données d'authentification
   - 2.3 Données d'utilisation
   - 2.4 Données issues de l'OCR
3. [Finalités des traitements](#3-finalités-des-traitements)
4. [Base légale](#4-base-légale)
   - Exécution du contrat (Art. 6.1.b)
   - Obligation légale (Art. 6.1.c)
   - Consentement (Art. 6.1.a)
5. [Conservation des données](#5-conservation-des-données)
6. [Sécurité des données](#6-sécurité-des-données)
7. [Droits des utilisateurs](#7-droits-des-utilisateurs)
   - Les droits applicables
   - Comment exercer ces droits
   - Délais de traitement
   - Suppression de compte
8. [Gestion des incidents (Data Breach)](#8-gestion-des-incidents-data-breach)
   - Détection et analyse
   - Notification à la CNIL (Art. 33.1)
   - Notification aux utilisateurs (Art. 34.1)
   - Suivi
9. [Utilisation d'API tierces](#9-utilisation-dapi-tierces)
   - API utilisées en V1
   - Principes appliqués
10. [Localisation et hébergement des données](#10-localisation-et-hébergement-des-données)
    - Sous-traitants et hébergeurs
    - API tierces et transferts hors UE
    - Isolation des environnements
11. [Minimisation des données](#11-minimisation-des-données)
    - Choix techniques en faveur de la minimisation
    - Bénéfices
12. [Cookies et traceurs](#12-cookies-et-traceurs)
13. [Registre des traitements](#13-registre-des-traitements)
14. [Protection des mineurs](#14-protection-des-mineurs)
15. [Politique de confidentialité utilisateur](#15-politique-de-confidentialité-utilisateur)
16. [Évolution future](#16-évolution-future)

---

## 1. Objectif et responsable de traitement

Ce document décrit les mesures mises en place afin de garantir la conformité 
du projet CollectionR avec le RGPD (Règlement Général sur la Protection 
des Données, UE 2016/679).

L'objectif est de :
- protéger les données personnelles des utilisateurs ;
- assurer la transparence des traitements ;
- limiter la collecte et la conservation des données ;
- garantir les droits des utilisateurs.

### Responsable de traitement

Conformément à l'article 13.1.a du RGPD, le responsable de traitement est 
l'équipe co-fondatrice du projet CollectionR. Toute demande relative aux 
données personnelles peut être adressée à : privacy@collectionr.app

Cette désignation sera formalisée lors du passage en production.

---

## 2. Données collectées

Dans le cadre de son fonctionnement, CollectionR collecte uniquement 
les données strictement nécessaires à la fourniture du service. 
Voici le détail de chaque catégorie.

### 2.1 Données d'identification

Pour créer et gérer un compte, la plateforme collecte :
- adresse email ;
- identifiant utilisateur unique généré à la création du compte.

### 2.2 Données d'authentification

Afin de sécuriser l'accès au compte, CollectionR collecte :
- mot de passe stocké sous forme hashée (bcrypt), jamais conservé en clair.

Le hash est une technique qui transforme le mot de passe en une 
empreinte illisible — même l'équipe technique ne peut pas lire 
votre mot de passe.

### 2.3 Données d'utilisation

Pour assurer le bon fonctionnement et l'amélioration du service, 
la plateforme enregistre :
- les actions réalisées sur la plateforme ;
- l'historique d'utilisation (ex. : scans de cartes réalisés).

Ces données ne sont pas vendues ni partagées avec des tiers.

### 2.4 Données issues de l'OCR

L'application permet de scanner des cartes via un mécanisme d'OCR 
(reconnaissance optique de caractères). Ce traitement est réalisé 
côté serveur, au sein du microservice Python dédié (FastAPI + YOLO/OpenCV).

Les images analysées peuvent contenir des données textuelles issues 
des cartes. Bien que le cas d'usage concerne des cartes de collection 
(Pokémon V1), ces données sont considérées comme potentiellement 
sensibles par principe de précaution.

Les mesures suivantes s'appliquent :
- traitement limité à la reconnaissance et à l'identification de la carte ;
- images purgées automatiquement du pipeline après traitement (Art. 5.1.e) ;
- absence de stockage permanent des images.

---

## 3. Finalités des traitements

La finalité désigne la raison précise pour laquelle une donnée est collectée. 
Le RGPD impose que chaque donnée collectée ait une finalité claire, légitime 
et définie à l'avance — elle ne peut pas être réutilisée pour un autre usage 
sans en informer l'utilisateur.

Les données collectées par CollectionR répondent aux finalités suivantes :

| Donnée | Finalité | Base légale |
|--------|----------|-------------|
| Email | Authentification et gestion du compte | Art. 6.1.b — Exécution du contrat |
| Mot de passe (hashé) | Sécurisation de l'accès | Art. 6.1.b — Exécution du contrat |
| Données OCR | Reconnaissance et identification des cartes | Art. 6.1.b — Exécution du contrat |
| Données API cartes | Affichage des informations de collection | Art. 6.1.b — Exécution du contrat |
| Logs techniques | Sécurité, diagnostic et traçabilité | Art. 6.1.c — Obligation légale |

Chaque traitement est strictement limité à sa finalité déclarée. 
Aucune donnée n'est utilisée à des fins commerciales, publicitaires, 
ou partagée avec des tiers sans consentement explicite préalable.

---

## 4. Base légale

La base légale désigne le fondement juridique qui autorise CollectionR 
à traiter une donnée personnelle. Sans base légale valide, un traitement 
est illégal au regard du RGPD. Trois bases légales s'appliquent ici.

### Exécution du contrat (Art. 6.1.b)

C'est la base légale principale de CollectionR. Elle couvre l'ensemble 
des traitements nécessaires au fonctionnement du service : authentification, 
gestion de collection, et scan OCR.

L'OCR repose sur cette base et non sur le consentement : en s'inscrivant 
sur CollectionR, l'utilisateur accepte un service de scan de cartes. 
Fonder l'OCR sur le consentement (Art. 7.3) serait problématique — 
un utilisateur pourrait le retirer à tout moment, rendant le service 
inutilisable.

### Obligation légale (Art. 6.1.c)

Couvre la conservation minimale des logs de sécurité et d'audit, 
conformément aux obligations légales applicables.

### Consentement (Art. 6.1.a)

Réservé exclusivement aux fonctionnalités optionnelles, non essentielles 
au service (ex. : notifications, fonctionnalités futures). Ce consentement 
reste librement révocable à tout moment sans impact sur le fonctionnement 
principal de l'application (Art. 7.3).

Aucune donnée n'est utilisée en dehors des finalités définies 
sans consentement explicite préalable.

---

## 5. Conservation des données

Le RGPD impose que les données ne soient pas conservées plus longtemps 
que nécessaire au regard de leur finalité (principe de limitation de la 
conservation, Art. 5.1.e). Les durées appliquées par CollectionR sont 
les suivantes.

| Type de donnée | Durée de conservation | Justification |
|----------------|----------------------|---------------|
| Données de compte | Durée de vie du compte + 30 jours après clôture | Art. 6.1.b — Exécution du contrat |
| Logs applicatifs | 30 jours | Diagnostic et sécurité |
| Logs d'audit | 90 jours | Art. 6.1.c — Obligation légale |
| Images OCR | Supprimées après traitement (pipeline) | Art. 5.1.e — Minimisation |
| Données OCR traitées | Non conservées de manière permanente | Art. 5.1.e — Minimisation |

Les images de cartes ne sont pas stockées. Seules les références aux 
données externes (ex. : URLs d'images issues d'API tierces) peuvent 
être conservées.

Certaines données peuvent être anonymisées afin de conserver des 
statistiques agrégées sans identifier les utilisateurs.

Ces durées seront réévaluées périodiquement et documentées dans le 
registre des traitements (Art. 5.1.e / Art. 13.2.a). Toute évolution 
fera l'objet d'une mise à jour formalisée.

---

## 6. Sécurité des données

La sécurité des données repose sur un ensemble de mesures techniques 
et organisationnelles, détaillées dans les documents Threat Model et 
API Sécurité (docs/security/). Les mécanismes appliqués sont les suivants.

- chiffrement de toutes les communications via HTTPS / TLS ;
- stockage sécurisé des mots de passe par hachage bcrypt — 
  algorithme reconnu et recommandé pour ce type d'usage ;
- authentification par JWT et contrôle d'accès basé sur les rôles 
  (RBAC) pour limiter l'accès aux ressources selon le profil utilisateur ;
- principe du moindre privilège appliqué à l'ensemble des services — 
  chaque composant n'accède qu'aux données dont il a strictement besoin ;
- gestion des secrets via Kubernetes Secrets en environnement local 
  et VPS, avec évolution prévue vers Vault ou Doppler en production ;
- séparation stricte des environnements (dev / staging / production) 
  pour éviter toute fuite de données entre contextes.

Les données sensibles ne sont jamais exposées dans les logs. 
Les règles de filtrage appliquées sont décrites dans le document 
Logs & Audit (docs/security/).

Les accès aux données personnelles sont eux-mêmes tracés et 
journalisés via Loki + Grafana + Promtail, afin de détecter 
tout accès non autorisé ou anormal. Ces journaux d'accès sont 
soumis aux mêmes règles de conservation que les logs d'audit 
(90 jours, section 5).

---

## 7. Droits des utilisateurs

Le RGPD accorde aux utilisateurs un ensemble de droits sur leurs 
données personnelles. CollectionR s'engage à les respecter et à 
faciliter leur exercice.

### Les droits applicables

- droit d'accès : consulter l'ensemble des données detenues (Art. 15) ;
- droit de rectification : corriger des données inexactes (Art. 16) ;
- droit à la suppression : demander l'effacement des données, 
  dit "droit à l'oubli" (Art. 17) ;
- droit à la portabilité : récupérer ses données dans un format 
  lisible et réutilisable (Art. 20) ;
- droit à la limitation du traitement : suspendre l'utilisation 
  de ses données sans les supprimer (Art. 18).

### Comment exercer ces droits

Ces droits peuvent être exercés de deux façons :

- directement via les fonctionnalités de l'application 
  (ex. : suppression de compte depuis les paramètres) ;
- par demande écrite adressée à : privacy@collectionr.app

### Délais de traitement

Conformément à l'article 12.3 du RGPD, toute demande est traitée 
dans un délai d'un mois à compter de sa réception. Ce délai peut 
être prolongé de deux mois supplémentaires en cas de demande complexe 
ou multiple — l'utilisateur est alors informé de cette prolongation 
dans le délai initial d'un mois.

### Suppression de compte

Lorsqu'un utilisateur exerce son droit à l'effacement, la suppression 
est appliquée en cascade sur l'ensemble de ses données : compte, 
historique d'utilisation et données de collection associées.

Cette suppression intervient dans un délai maximum de 30 jours 
suivant la demande. Seules les données soumises à une obligation 
légale de conservation (ex. : logs d'audit) sont conservées pour 
la durée prévue en section 5, puis supprimées définitivement.

---

## 8. Gestion des incidents (Data Breach)

Une violation de données personnelles désigne tout incident entraînant 
la destruction, la perte, l'altération ou la divulgation non autorisée 
de données. CollectionR applique la procédure suivante en cas d'incident.

### Détection et analyse

- l'incident est détecté via les systèmes de logs et de monitoring 
  (Loki + Grafana + Promtail) ;
- une analyse de l'impact est réalisée immédiatement : nature des données 
  compromises, nombre de personnes concernées, gravité du risque.

### Notification à la CNIL (Art. 33.1)

La notification à la CNIL est une obligation légale dès lors que 
la violation est susceptible d'engendrer un risque pour les droits 
et libertés des personnes. Cette notification doit intervenir 
dans un délai maximum de 72 heures après la prise de connaissance 
de l'incident.

### Notification aux utilisateurs (Art. 34.1)

Lorsque la violation est susceptible d'engendrer un risque élevé 
pour les personnes concernées, celles-ci sont notifiées sans délai 
injustifié. Cette notification décrit clairement la nature de 
l'incident et les mesures prises pour y remédier.

### Suivi

- des mesures correctives sont mises en place immédiatement ;
- chaque incident est documenté dans un registre des violations, 
  afin de permettre son analyse et son suivi dans le temps.

---

## 9. Utilisation d'API tierces

CollectionR s'appuie sur des API publiques externes pour récupérer 
les informations relatives aux cartes (nom, caractéristiques, visuels). 
Ces API ne reçoivent aucune donnée personnelle identifiante — seules 
des requêtes de recherche de cartes leur sont transmises.

### API utilisées en V1

- pTCGdex (api.tcgdex.net) — métadonnées, visuels et prix agrégés des cartes Pokémon.
  Licence MIT pour les métadonnées. Aucune donnée personnelle transmise;
- toute API complémentaire intégrée ultérieurement fera l'objet 
  d'un avenant à ce document.

### Principes appliqués

Les principes suivants encadrent l'utilisation de ces API, 
conformément aux articles 13.1.e et 28 du RGPD :

- aucune copie locale des images — seules les URLs fournies 
  par les API sont conservées ;
- respect des conditions d'utilisation de chaque API 
  (licence, attribution) ;
- les données affichées restent la propriété de leurs 
  détenteurs respectifs ;
- en cas de recours à un sous-traitant au sens du RGPD, 
  un contrat de traitement des données (DPA) sera établi 
  conformément à l'Art. 28.

---

## 10. Localisation et hébergement des données

Le RGPD encadre strictement les transferts de données personnelles 
hors de l'Union Européenne (Art. 44 à 49). CollectionR applique 
les règles suivantes.

### Sous-traitants et hébergeurs

**Phase actuelle — développement local**

La plateforme fonctionne actuellement en environnement local sur les 
postes de l'équipe (K3s local). Aucun hébergeur tiers n'est impliqué 
à ce stade. Aucune donnée utilisateur réelle n'est traitée.

**Phase future — mise en production**

Lors du déploiement en production, un hébergeur VPS sera retenu parmi 
les options suivantes, toutes certifiées ISO 27001 et localisées 
au sein de l'Union Européenne :

| Hébergeur | Localisation | Certification |
|-----------|--------------|---------------|
| Hetzner | Allemagne / Finlande | ISO 27001 |
| Scaleway | France | HDS, ISO 27001 |
| OVH | France | HDS, ISO 27001 |

Le choix définitif sera effectué lors de la phase de réalisation. 
Un contrat de sous-traitance conforme à l'article 28 du RGPD sera 
établi avec l'hébergeur retenu avant tout traitement de données réelles.

Les sauvegardes de la base de données (PostgreSQL) seront soumises 
aux mêmes exigences de sécurité et aux mêmes durées de conservation 
que les données qu'elles contiennent.

### API tierces et transferts hors UE

Certaines API tierces utilisées par CollectionR, notamment TCGdex, 
peuvent disposer de serveurs localisés hors de l'Union Européenne 
(potentiellement aux États-Unis).

Les garanties suivantes s'appliquent dans ce cas :

- aucune donnée personnelle identifiante n'est transmise à ces API —
  seules des requêtes de recherche de cartes sont effectuées ;
- les transferts éventuels sont encadrés par les clauses contractuelles 
  types (CCT) de la Commission Européenne (Art. 46.2.c).

### Isolation des environnements

Les environnements dev, staging et production sont strictement 
cloisonnés afin d'éviter toute fuite de données entre contextes.

---

## 11. Minimisation des données

Le principe de minimisation (Art. 5.1.c du RGPD) impose de ne collecter 
que les données strictement nécessaires à la finalité poursuivie. 
CollectionR applique ce principe à tous les niveaux de l'application.

### Choix techniques en faveur de la minimisation

Plusieurs décisions d'architecture traduisent concrètement cet engagement :

- les images de cartes scannées sont purgées automatiquement après 
  traitement par le microservice OCR — elles ne sont jamais stockées ;
- seules les références externes (URLs d'images issues des API tierces) 
  sont conservées, jamais les images elles-mêmes ;
- les logs techniques ne contiennent aucune donnée personnelle 
  identifiante (voir document Logs & Audit, docs/security/) ;
- certaines données peuvent être anonymisées afin de conserver 
  des statistiques agrégées sans identifier les utilisateurs.

### Bénéfices

Cette approche produit deux effets directs :

- réduction de la surface d'exposition en cas de fuite ou d'incident 
  de sécurité ;
- conformité renforcée avec le RGPD, les données non collectées 
  ne pouvant par définition pas être compromises.

---

## 12. Cookies et traceurs

Conformément à la Directive ePrivacy (Art. 5.3) et aux recommandations 
de la CNIL, CollectionR n'utilise pas de cookies de tracking ni 
de traceurs publicitaires tiers.

Seuls des cookies strictement nécessaires au fonctionnement du service 
peuvent être utilisés, par exemple un jeton de session pour maintenir 
l'utilisateur connecté. Ces cookies techniques ne nécessitent pas 
de consentement préalable.

Toute évolution vers l'utilisation de traceurs optionnels fera l'objet 
d'une mise à jour de ce document et de la mise en place d'un bandeau 
de consentement conforme aux exigences de la CNIL.

---

## 13. Registre des traitements

Conformément à l'article 30 du RGPD, CollectionR prévoit la tenue 
d'un registre des activités de traitement. Ce registre recense 
l'ensemble des traitements de données personnelles réalisés par 
la plateforme.

Il comprend notamment :

- la nature et la finalité de chaque traitement ;
- les catégories de données concernées ;
- les destinataires des données (internes et externes) ;
- les durées de conservation appliquées ;
- les mesures de sécurité techniques et organisationnelles mises 
  en œuvre.

Le registre sera maintenu à jour et disponible sur demande auprès 
du responsable de traitement à l'adresse : privacy@collectionr.app

---

## 14. Protection des mineurs

Le public cible de CollectionR inclut potentiellement des joueurs 
de jeux de cartes à collectionner, dont une partie peut être mineure. 
Conformément à l'article 8 du RGPD et à la législation française :

- l'âge minimum requis pour créer un compte est fixé à 15 ans, 
  seuil du consentement numérique en France ;
- pour les utilisateurs de moins de 15 ans, le consentement d'un 
  titulaire de l'autorité parentale est requis avant toute création 
  de compte ;
- aucune donnée relative à un mineur de moins de 15 ans ne sera 
  collectée sans ce consentement parental.

Ces dispositions seront intégrées dans les conditions générales 
d'utilisation et dans la politique de confidentialité accessible 
dans l'application.

---

## 15. Politique de confidentialité utilisateur

Ce document constitue la version interne et technique de la politique 
RGPD de CollectionR. Conformément à l'article 12.1 du RGPD, une version 
lisible et accessible destinée aux utilisateurs finals sera publiée 
directement dans l'application.

Cette politique utilisateur devra :

- être rédigée en langage clair et compréhensible, sans jargon juridique ;
- être accessible avant toute création de compte ;
- couvrir l'ensemble des informations requises par les articles 
  13 et 14 du RGPD ;
- être mise à jour à chaque évolution significative des traitements 
  de données.

---

## 16. Évolution future

La conformité RGPD de CollectionR est pensée comme un processus 
continu et non comme un état figé. Les actions suivantes sont 
prévues au fil des phases du projet.

**Court terme — phase de réalisation**

- choix définitif de l'hébergeur et signature du contrat de 
  sous-traitance (Art. 28) ;
- publication de la politique de confidentialité utilisateur 
  dans l'application ;
- formalisation du registre des traitements (Art. 30).

**Moyen terme — mise en production**

- désignation formelle du responsable de traitement ;
- mise en place d'un portail self-service pour l'exercice 
  des droits utilisateurs ;
- audit de conformité RGPD avant ouverture au public.

**Long terme — évolution du service**

- réévaluation périodique des durées de conservation 
  documentée dans le registre des traitements ;
- adaptation du document en cas d'ajout de nouvelles 
  fonctionnalités ou de nouveaux traitements de données.