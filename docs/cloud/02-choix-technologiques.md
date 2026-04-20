# 🌐 Choix des solutions Cloud — Collectionr

Ce document explique comment nous avons choisi notre infrastructure Cloud pour le projet.

Notre objectif est simple :  
👉 faire fonctionner une application complète avec un budget de 0€, tout en gardant de bonnes performances et sans dépendre d’un seul fournisseur.

---

## 📖 Lexique simplifié

Quelques termes importants à comprendre :

- **IaaS** : location de serveurs sur lesquels on installe tout soi-même  
- **Vendor Lock-in** : dépendance à un fournisseur (difficile à quitter)  
- **K3s** : version légère de Kubernetes (outil pour gérer des applications)  
- **Egress Fees** : coûts pour envoyer des données vers Internet  

---

## 1. 🎯 Nos critères de choix

Pour choisir les bonnes solutions, on s’est basé sur 3 éléments principaux :

### 💰 Le budget (0€)
On privilégie uniquement les offres gratuites ou avec crédits offerts.

👉 Pourquoi :  
On ne peut pas se permettre de payer des services.

---

### ⏱️ Le temps et la complexité
On choisit des outils puissants mais simples à mettre en place.

👉 Pourquoi :  
Un outil trop complexe ferait perdre du temps au projet.

---

### 🔓 L’indépendance (anti dépendance)
Le projet doit pouvoir fonctionner sur n’importe quel fournisseur.

👉 Pourquoi :  
Si un service devient payant ou indisponible, on doit pouvoir migrer rapidement.

---

## 2. ⚖️ Comparaison des solutions

| Fournisseur | Gratuité | Dépendance | IA & Data | Complexité | Maintenance |
|------------|--------|-----------|----------|-----------|------------|
| Azure | 💰 Crédit offert | Moyenne | Très forte | Moyenne | Moyenne |
| Google Cloud | 💰 Crédit offert | Forte | Très forte | Simple | Faible |
| AWS | 💰 Gratuit limité | Moyenne | Forte | Complexe | Élevée |
| Oracle Cloud | 🆓 Gratuit permanent | Faible | Moyenne | Technique | Très faible |

👉 En résumé :  
Chaque solution a des avantages, mais aucune n’est parfaite seule.

---

## 3. 🧩 Notre choix : une architecture hybride

Au lieu de choisir un seul fournisseur, on combine plusieurs solutions.

👉 Pourquoi :  
On garde les avantages de chacun sans subir leurs inconvénients.

---

### 🏗️ Le cœur du système : Oracle Cloud

Oracle est utilisé pour héberger l’application principale.

- Serveurs gratuits disponibles en permanence
- Suffisant pour faire tourner toute l’application
- Pas de dépendance à des services propriétaires

👉 Résultat :  
L’application reste stable et fonctionne sans coût.

---

### 🤖 L’intelligence artificielle : Google Cloud

Google est utilisé uniquement pour les services d’IA.

- Utilisation d’API (Gemini, Vertex AI)
- Très performantes pour le traitement des données

👉 Risque :  
Consommer trop de crédits rapidement

👉 Solution :  
Si les crédits sont épuisés :
- l’IA s’arrête
- mais l’application continue de fonctionner normalement

---

## 4. ⚙️ Organisation technique

### 🔄 Compatibilité des serveurs

Les serveurs Oracle utilisent une architecture différente (ARM).

👉 Problème :  
Les applications ne fonctionnent pas directement dessus

👉 Solution :  
On construit des images Docker compatibles avec tous les systèmes

---

### 🔐 Sécurité et gestion des coûts

- Les communications entre services sont sécurisées
- Les accès sont limités et contrôlés
- Des alertes sont mises en place pour surveiller les dépenses

👉 Exemple :
- Alerte à 50$, 150$, 250$ sur Google Cloud

---

### 🌍 Gestion des données

- On limite les données envoyées entre services
- On envoie uniquement ce qui est nécessaire

👉 Pourquoi :  
- réduire les coûts
- améliorer la vitesse

---

## ✅ Conclusion

Cette stratégie permet de :

- utiliser uniquement des ressources gratuites
- éviter toute dépendance à un fournisseur
- garder une application stable et évolutive

👉 En résumé :  
On construit une architecture simple, économique et intelligente, adaptée à un projet étudiant mais proche des pratiques professionnelles.
