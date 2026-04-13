# RGPD & Conformité

## Sommaire

1. [Objectif](#1-objectif)
2. [Données collectées](#2-données-collectées)
3. [Finalités des traitements](#3-finalités-des-traitements)
4. [Base légale](#4-base-légale)
5. [Conservation des données](#5-conservation-des-données)
6. [Sécurité des données](#6-sécurité-des-données)
7. [Droits des utilisateurs](#7-droits-des-utilisateurs)
8. [Gestion des incidents (Data Breach)](#8-gestion-des-incidents-data-breach)
9. [Utilisation d’API tierces](#9-utilisation-dapi-tierces)
10. [Localisation et hébergement des données](#10-localisation-et-hébergement-des-données)
11. [Minimisation des données](#11-minimisation-des-données)
12. [Évolution future](#12-évolution-future)

---

## 1. Objectif

Ce document décrit les mesures mises en place afin de garantir la conformité du projet ESP avec le RGPD (Règlement Général sur la Protection des Données).

L’objectif est de :

- protéger les données personnelles des utilisateurs
- assurer la transparence des traitements
- limiter la collecte et la conservation des données
- garantir les droits des utilisateurs

---

## 2. Données collectées

Dans le cadre de son fonctionnement, la plateforme peut collecter les données suivantes :

### 2.1 Données d’identification

- adresse email
- identifiant utilisateur

### 2.2 Données d’authentification

- mot de passe (stocké sous forme hashée, jamais en clair)

### 2.3 Données d’utilisation

- actions réalisées sur la plateforme
- historique d’utilisation (ex : scans de cartes)

### 2.4 Données issues de l’OCR

L’application permet de scanner des cartes via un mécanisme d’OCR (reconnaissance optique de caractères).

Les images analysées peuvent contenir des données textuelles issues des cartes.

Bien que le cas d’usage concerne principalement des cartes de collection (ex : Pokémon, Magic), ces données sont considérées comme **potentiellement sensibles** par principe.

Ces données font l’objet des mesures suivantes :

- traitement limité à la reconnaissance et à l’analyse
- absence de stockage permanent des images
- suppression automatique après traitement ou conservation très limitée

---

## 3. Finalités des traitements

Les données sont collectées pour les finalités suivantes :

| Donnée | Finalité |
|------|--------|
| Email | Authentification et gestion du compte |
| Mot de passe | Sécurisation de l’accès |
| Données OCR | Reconnaissance et identification des cartes |
| Données API cartes | Affichage des informations de collection |
| Logs techniques | Sécurité et diagnostic |

Les traitements sont limités aux besoins stricts de l’application.

---

## 4. Base légale

Les traitements reposent sur les bases légales suivantes :

- **Exécution du service** : fonctionnement de l’application (authentification, gestion de collection, OCR)
- **Consentement utilisateur** : utilisation des fonctionnalités de scan et d’analyse
- **Obligation légale** : sécurité et conservation minimale des logs

Aucune donnée n’est utilisée en dehors des finalités définies sans consentement explicite.

---

## 5. Conservation des données

Les données sont conservées pour une durée limitée :

| Type de donnée | Durée de conservation |
|---------------|----------------------|
| Données de compte | durée de vie du compte |
| Logs applicatifs | 30 jours |
| Logs d’audit | 90 jours |
| Données OCR | supprimées après traitement ou courte durée |

Les images de cartes ne sont pas stockées.

Seules les références aux données externes (ex : URLs d’images issues d’API tierces) peuvent être conservées.

Certaines données peuvent être anonymisées afin de conserver des statistiques sans identifier les utilisateurs.

Ces durées peuvent évoluer en fonction des besoins du projet.

---

## 6. Sécurité des données

Les données sont protégées via plusieurs mécanismes :

- chiffrement des communications (HTTPS / TLS)
- stockage sécurisé des mots de passe (hash)
- authentification et contrôle d’accès stricts
- limitation des accès aux données
- séparation des environnements (dev / staging / production)

Les données sensibles ne sont jamais exposées dans les logs (voir document "Logs & Audit").

---

## 7. Droits des utilisateurs

Conformément au RGPD, les utilisateurs disposent des droits suivants :

- droit d’accès à leurs données
- droit de rectification
- droit à la suppression (droit à l’oubli)
- droit à la portabilité
- droit à la limitation du traitement

Ces droits peuvent être exercés :

- via les fonctionnalités de l’application (ex : suppression de compte)
- ou via une demande spécifique

Les demandes sont traitées dans des délais raisonnables.

---

## 8. Gestion des incidents (Data Breach)

En cas de violation de données personnelles :

- l’incident est détecté via les systèmes de logs et de monitoring
- une analyse de l’impact est réalisée
- des mesures correctives sont mises en place
- une notification peut être effectuée si nécessaire

Les incidents sont tracés afin de permettre leur analyse et leur suivi.

---

## 9. Utilisation d’API tierces

L’application utilise des API publiques pour récupérer des informations sur les cartes (nom, caractéristiques, visuels).

Les principes suivants sont appliqués :

- aucune copie locale des images
- utilisation des URLs fournies par les API
- respect des conditions d’utilisation des API (licence, attribution)

Les données affichées restent la propriété de leurs détenteurs respectifs.

---

## 10. Localisation et hébergement des données

Les données sont hébergées sur des infrastructures cloud (VPS type Hetzner ou Scaleway).

Les environnements sont sécurisés et isolés.

Dans la mesure du possible, les données sont hébergées au sein de l’Union Européenne.

---

## 11. Minimisation des données

Seules les données strictement nécessaires au fonctionnement de l’application sont collectées.

Aucune donnée inutile ou excessive n’est conservée.

Cette approche permet de réduire les risques en cas de fuite.

---

## 12. Évolution future

Dans le cadre de l’évolution du projet :

- amélioration des mécanismes d’anonymisation
- renforcement des outils de gestion des droits utilisateurs
- audit régulier des pratiques de sécurité

La conformité RGPD sera maintenue dans le temps.
