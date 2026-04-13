# Architecture Logique - Collectionr  
## 1. Vision et Cohérence Globale (COLLR-146)

Le projet Collectionr est une application de gestion de cartes à collectionner TCG. L'architecture est conçue pour être asynchrone et distribuée afin de supporter des modèles d'IA gourmands en ressources sans bloquer l'expérience utilisateur.

---

## 2. Couches Logiques (COLLR-141)

L'architecture se décompose en quatre couches distinctes :

- Couche Présentation : Interfaces clients mobiles (React Native/Expo) et web (React).

- Couche Métier (Application) : Logique de gestion des collections, authentification et orchestration des tâches via Node.js.

- Couche Traitement : Services spécialisés d'IA (Python) et de synchronisation de données (TCG).

- Couche de Données : Persistance via PostgreSQL, stockage de fichiers permanent et gestion de files d'attente Redis.

---

## 3. Composants Applicatifs Principaux (COLLR-142)

- Backend Node.js : Gère l'API REST, l'authentification JWT et la distribution des jobs.

- Worker OCR (IA) : Pipeline utilisant YOLOv10 et PaddleOCR pour l'extraction de données.

- Microservice TCG : Gère la mise à jour des catalogues de cartes et les prix du marché.

- Workers TCG (Scraping & API) : Agents dédiés à l'extraction de données externes.

---

## 4. Interactions entre Composants (COLLR-143)

- Le Frontend envoie une image au Backend.

- Le Backend stocke l'image sur le Volume Partagé Permanent et crée une tâche dans Redis.

- Le Worker OCR traite l'image et met à jour le statut dans Redis.

- Le Backend notifie le Frontend de la fin du traitement via une connexion SSE.

---

## 5. Dépendances Fonctionnelles (COLLR-144)

- Identification de carte : Le Worker OCR dépend de la disponibilité de l'image sur le Volume Partagé et de la présence du job dans Redis.

- Mise à jour des prix : Le Microservice TCG dépend de l'accessibilité des Marketplaces externes et des API tierces.

- Interface utilisateur : Le Frontend dépend de la stabilité du contrat API (OpenAPI/Swagger) défini par le Backend.

---

## 6. Points d'Intégration Externes (COLLR-145)

- API TCG Tierces : Utilisation d'API comme Cardmarket ou TCGPlayer pour les métadonnées officielles.

- Marketplaces : Scraping des prix de vente pour l'estimation en temps réel.

- Authentification (Optionnel) : Possibilité d'intégration d'OAuth (Google/Apple) pour simplifier l'accès utilisateur.
