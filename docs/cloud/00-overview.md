# 00 - Architecture Overview (Vision Globale)

## 1. Contexte et Objectifs
La plateforme vise à révolutionner la gestion de collections de cartes de jeu (**TCG** : Pokémon, Yu-Gi-Oh!, etc.) par une approche "**Digital First**".

* **Objectif principal :** Permettre aux collectionneurs de numériser instantanément leurs cartes physiques via une IA de reconnaissance, d'en vérifier l'authenticité et d'en suivre la valeur marchande en temps réel.
* **Valeur ajoutée :** Rapidité du scan (multi-cartes), précision de l'expertise (détection de faux/état) et centralisation des données de marché.

---

## 2. Vision High-Level
L'architecture repose sur un écosystème **découplé** où le Cloud sert de hub central pour le traitement lourd (IA) et la persistance des données.



---

## 3. Grandes Briques Fonctionnelles & Responsabilités

| Couche | Technologie | Responsabilités principales |
| :--- | :--- | :--- |
| **Frontend** | React / React Native | Interface utilisateur (Web/Mobile), capture d'image, affichage des prix. |
| **Backend Core** | Node.js + Prisma | **Service maître du cycle de vie des données**. Exposition des APIs, authentification et logique métier. |
| **Data / IA Service** | Python (FastAPI) | Computer Vision (Authentification), Prédiction de prix (Data Science). |
| **Persistance** | PostgreSQL | Stockage des métadonnées, utilisateurs et catalogues de prix. |
| **Infrastructure** | Docker / K8s | Conteneurisation, orchestration et isolation des environnements. |

---

## 4. Choix de l'ORM : Prisma
Pour garantir la cohérence des données sur un cycle de 1 an et demi, **Prisma** a été choisi comme l'ORM de référence.

* **Single Source of Truth :** Le fichier `schema.prisma` définit la structure unique de la base de données.
* **Type-Safety :** Génération automatique des types TypeScript pour le Backend Core, réduisant drastiquement les erreurs de production.
* **Maîtrise des Migrations :** Node.js est l'unique responsable des migrations (`prisma migrate`), assurant que le schéma n'évolue pas de manière anarchique entre les services.

---

## 5. Stratégie Cloud & DevOps

### Cloud-Agnostic & Portabilité
Le projet est conçu pour être déployé sur **AWS, GCP ou Azure** sans modification majeure du code.
* **Abstraction :** Utilisation de conteneurs Docker pour isoler les dépendances.
* **Infrastructure as Code (IaC) :** Utilisation de Terraform (à confirmer) pour le provisionnement.

### Scénarios de Déploiement
* **Développement :** Utilisation de **Docker Compose** pour simuler l'ensemble de l'écosystème localement.
* **Production :** Orchestration via **Kubernetes (K8s)** pour permettre l'autoscaling indépendant du service IA (calcul intensif) par rapport au backend métier.

---

## 6. Principes d'Architecture
* **Modularité :** Communication entre Node.js et Python via API REST interne ou Message Broker.
* **Découplage de la Donnée :** Le service Python accède aux données en lecture seule ou via des APIs dédiées pour ne pas interférer avec le cycle de vie géré par Prisma.
* **Résilience :** Système de file d'attente (Queue) pour les scans d'images afin d'absorber les pics de charge sans bloquer l'interface utilisateur.

---

## 7. Contraintes & Hypothèses Structurantes

### Sécurité & Données
- Chiffrement des données en transit et au repos.
- Gestion centralisée des secrets.
- Les images de cartes ne sont pas considérées comme des données métier persistantes mais comme des artefacts techniques temporaires.

### Gestion des images & Flux IA
- Les images capturées sont transmises au service IA via API.
- Le stockage des images est **temporaire** (durée courte, lifecycle contrôlé) et principalement destiné :
  - au traitement IA,
  - à des besoins de debug ou d’audit ponctuels.
- Aucune volumétrie long terme n’est engagée à ce stade pour les images.

### Contraintes API & Rate Limiting
- Les services IA sont soumis à des **quotas et limites de taux** imposés par les fournisseurs.
- L’architecture intègre un mécanisme de **file d’attente et de régulation** afin :
  - d’absorber les pics de demandes,
  - de protéger les APIs IA,
  - de maîtriser les coûts.
- Le système est conçu pour refuser ou différer proprement les requêtes en cas de dépassement de quota.

### Coûts & Modèle de Consommation
- Les services IA reposent sur un modèle **pay-as-you-go**.
- Les tests actuels restent dans les **quotas gratuits** des fournisseurs.
- Toute montée en charge au-delà de ces quotas entraîne mécaniquement des coûts.
- L’architecture vise donc une **maîtrise du risque financier** via :
  - limitation volontaire des appels IA,
  - activation ciblée des traitements,
  - absence de ressources IA actives en continu.

