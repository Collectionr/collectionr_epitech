# Choix des solutions Cloud — Collectionr

Ce document présente l'évolution de notre stratégie d'infrastructure, passant d'un modèle multi-cloud gratuit à une architecture souveraine basée sur K3s pour la phase de prototypage.

## Sommaire

1. [Phase de Prototypage : L'ère K3s](#1-phase-de-prototypage--lère-k3s)
2. [Rôle de Docker et Kubernetes](#2-rôle-de-docker-et-kubernetes)
3. [Environnements et namespaces](#3-environnements-et-namespaces)
4. [Stratégie de Portabilité](#4-stratégie-de-portabilité)
5. [Risques et Dépendances (Vendor Lock-in)](#5-risques-et-dépendances-vendor-lock-in)
6. [Phase de Production : Vers le Cloud Managé](#6-phase-de-production--vers-le-cloud-managé)
7. [Conclusion](#conclusion)

---

## 1. Phase de Prototypage : L'ère K3s

Pour lancer le projet rapidement et à moindre coût, nous avons opté pour une approche progressive utilisant K3s, une version légère de Kubernetes. Cette phase permet de valider les concepts techniques tout en maîtrisant les dépenses opérationnelles.

### Comparaison des environnements de prototypage

Le tableau ci-dessous synthétise les options disponibles pour cette phase de test et de validation :

| Solution | Coût | Complexité | Parité Prod | Maintenance | Usage recommandé |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Docker Compose** | 0 € | Très Faible | Faible | Manuelle | Debug rapide de services isolés |
| **K3s Local** | 0 € | Moyenne | Élevée | Équipe | Développement et tests d'intégration |
| **K3s + VPS** | 20-40 € / mois | Moyenne | Élevée | Équipe | Prototype partagé et tests utilisateurs |
| **K8s Managé** | 40 €+ / mois | Faible | Maximale | Hébergeur | Phase de Production (Cible finale) |

### Étape 1 : K3s Local 
Le développement commence par l'installation de K3s sur les postes locaux ou un serveur de test interne pour garantir une base technique solide dès les premières lignes de code.

*   **Besoin :** Disposer d'un environnement identique à la production sans aucun coût.
*   **Solution :** Utiliser K3s pour orchestrer les microservices localement.
*   **Pourquoi ce choix :** K3s consomme très peu de ressources (moins de 512 Mo de RAM pour le plan de contrôle), ce qui le rend idéal pour des machines de développement.

### Étape 2 : K3s + VPS 
Une fois le prototype local stabilisé, nous migrons vers un **VPS (Virtual Private Server)** pour ouvrir l'application à des tests plus larges.

*   **Besoin :** Rendre l'application accessible via Internet pour les tests utilisateurs et l'équipe.
*   **Solution :** Installation de K3s sur un VPS d'entrée de gamme.
*   **Pourquoi ce choix :** Un VPS offre une IP publique fixe et une disponibilité 24/7 pour un coût maîtrisé (20-40€/mois selon la configuration retenue), tout en conservant la main totale sur l'OS et l'orchestrateur.

---

## 2. Rôle de Docker et Kubernetes 

Le succès de cette architecture repose sur la collaboration étroite entre la conteneurisation et l'orchestration. Durant cette phase, ces deux technologies jouent des rôles complémentaires mais distincts :

*   **Docker :** Utilisé pour la **conteneurisation**. Il permet d'empaqueter chaque microservice (Node.js, Python, Scrapers) avec ses dépendances dans une image immuable. Cela garantit que "ça marche sur ma machine" signifie "ça marchera sur le serveur".
*   **Kubernetes (K3s) :** Utilisé pour l'**orchestration**. Son rôle est de gérer le cycle de vie des conteneurs : démarrage, redémarrage automatique en cas de crash, gestion du réseau interne (DNS, Services) et exposition des APIs via un Ingress Controller.

---

## 3. Environnements et namespaces

Afin de maintenir une séparation stricte des flux et des données, le cluster K3s est organisé en namespaces distincts pour isoler les environnements :

- **development** : K3s local sur les postes de l'équipe pour les itérations quotidiennes.
- **staging** : K3s VPS partagé pour les tests de validation d'équipe.
- **production** : K3s VPS multi-nœuds ou K8s managé pour l'exposition finale.

Chaque namespace dispose de ses propres secrets, configurations et accès RBAC. Cette isolation garantit qu'aucune donnée de production ne transite dans les environnements de développement ou staging.

---

## 4. Stratégie de Portabilité 

Pour assurer la pérennité du projet, nous avons mis en place une stratégie de portabilité stricte. L'objectif est de pouvoir migrer d'un hébergeur à un autre sans aucune friction technique :

1.  **Manifestes Standards :** Utilisation de fichiers YAML Kubernetes standards. Aucune ressource spécifique à un fournisseur (comme un LoadBalancer propriétaire) n'est utilisée.
2.  **Images Multi-Arch :** les images Docker sont construites en multi-architecture (x86-64 et ARM64) afin de garantir la compatibilité avec l'ensemble des postes de l'équipe (macOS Apple M4 Pro) et les serveurs de production.
3.  **Abstraction du Stockage :** Utilisation de classes de stockage standards pour rester compatible avec n'importe quel fournisseur de volumes persistants.

---

## 5. Risques et Dépendances (Vendor Lock-in)

Cette architecture "agnostique" réduit drastiquement le risque de **Vendor Lock-in**, un enjeu crucial pour un projet à budget limité :

*   **Risque Faible :** Le code et l'infrastructure sont portables. Si un hébergeur augmente ses prix ou ferme ses services, la migration vers un autre VPS se résume à une réinstallation de K3s (automatisable) et au déploiement des manifestes.
*   **Indépendance :** Nous ne dépendons pas des services propriétaires (DB managée, Auth managée) des "Big Cloud" (AWS/GCP/Azure).

---

## 6. Phase de Production : Vers le Cloud Managé

Lorsque le projet atteindra sa maturité pour un usage intensif, nous prévoyons de basculer vers un **Kubernetes Managé** pour garantir une haute disponibilité sans augmenter la charge de maintenance de l'équipe.

### Fournisseurs identifiés
Nous privilégierons des acteurs offrant un bon rapport performance/prix et une souveraineté des données :

1.  **Scaleway (Kapsule) :** Excellent support Kubernetes en France, interface simple et prix compétitifs.
2.  **OVHcloud (Managed Kubernetes) :** Solution souveraine, infrastructure robuste, idéal pour la conformité européenne.

### Pourquoi ce choix pour la production ?
Le passage au managé permet de déléguer la maintenance du "Control Plane" au fournisseur. Cela permet à l'équipe de se concentrer uniquement sur les fonctionnalités métier tout en garantissant un niveau de service (SLA) élevé.

---

## Conclusion

Cette stratégie garantit une maîtrise totale des coûts pour le prototype tout en préparant techniquement le projet à une montée en charge industrielle. L'utilisation de K3s dès le départ évite toute refonte majeure lors du passage au Cloud managé.

Le détail des coûts par palier et la comparaison complète des solutions sont disponibles dans le document Benchmark Docker vs K3s.
