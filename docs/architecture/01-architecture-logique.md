# Architecture Logique - Collectionr (version simplifiée)

---

## 1. Vision globale

Le projet **Collectionr** est une application qui permet de gérer des cartes à collectionner (Pokémon, Magic, etc.).

L’architecture est conçue pour être :

- **Asynchrone** : les tâches lourdes (comme l’IA) ne bloquent pas l’utilisateur  
- **Distribuée** : plusieurs services travaillent ensemble  
- **Modulaire** : chaque partie peut évoluer indépendamment  

👉 Objectif :  
Permettre des traitements complexes (IA, scraping) tout en gardant une application fluide.

---

## 2. Organisation du code (structure propre)

Pour garder un code clair et facile à maintenir, le projet est organisé en plusieurs couches :

- **Domaine (Core)** : contient les règles métier (cartes, collections)  
- **Application** : gère les actions principales (ajouter une carte, mettre à jour un prix)  
- **Infrastructure** : gère les outils techniques (base de données, API externes)  
- **Présentation** : gère ce que voit l’utilisateur (API, interface mobile/web)  

👉 Pourquoi :  
Cela permet de modifier une partie du projet sans casser le reste.

---

## 3. Les principaux composants

Chaque partie du système a un rôle précis :

- **Backend (Node.js)** : point d’entrée principal, gère les utilisateurs et les actions  
- **Worker IA (OCR)** : analyse les images pour extraire les informations  
- **Service TCG** : récupère les données des cartes et les prix  
- **Redis** : gère les tâches en attente (file d’attente)

👉 Pourquoi :  
Chaque service est spécialisé, ce qui rend le système plus robuste.

---

## 4. Comment les services communiquent

Le fonctionnement se fait en plusieurs étapes :

1. L’utilisateur envoie une image  
2. Le backend enregistre l’image et crée une tâche  
3. Le service IA traite l’image  
4. Le résultat est renvoyé à l’utilisateur en temps réel  

👉 Important :  
L’utilisateur n’attend pas bloqué → tout se fait en arrière-plan.

---

## 5. Infrastructure, suivi et sécurité

Même avec un budget limité, on met en place des bonnes pratiques :

### 📊 Suivi (observabilité)
- On surveille le système avec des outils comme Grafana  
- On vérifie que tout fonctionne correctement  

### 💾 Stockage
- Les données sont stockées en base de données  
- Les fichiers (images) sont stockés séparément  

### 🔐 Sécurité
- Connexions sécurisées (HTTPS)  
- Gestion des accès et des clés API  
- Respect des bonnes pratiques de sécurité  

### ✅ Qualité
- Tests automatiques pour éviter les bugs  
- Déploiement automatisé pour éviter les erreurs humaines  

---

## ✅ Conclusion

Cette architecture permet de :

- gérer des traitements complexes sans ralentir l’application  
- garder un code propre et évolutif  
- assurer une bonne fiabilité même avec peu de moyens  

👉 En résumé :  
Une architecture simple à comprendre, mais solide dans son fonctionnement.
