# 🛰️ Suivi des performances et fiabilité — Collectionr

Ce document explique comment on s’assure que l’application fonctionne correctement, reste rapide et évite les pannes.

Même si la technique derrière est complexe, l’objectif reste simple : offrir une expérience fluide et fiable aux utilisateurs.

---

## 1. 🎯 Objectifs de qualité

On définit des objectifs précis pour vérifier que tout fonctionne bien.

📸 Traitement d’une image (OCR)  
→ 98% des images doivent être traitées en 2 à 5 secondes

🌐 API (communication avec l’application)  
→ 99% des requêtes doivent réussir  
→ Moins de 1% d’erreurs

🔄 Temps réel (connexion SSE)  
→ La connexion doit rester stable dans 97% des cas  
→ Pas de coupures inattendues

⏱️ Disponibilité générale  
→ L’application doit fonctionner 99% du temps  
→ Cela correspond à environ 7 heures de panne maximum par mois

👉 En résumé :  
On accepte un peu de maintenance, mais sans impact visible pour les utilisateurs.

---

## 2. 🧾 Gestion des logs

Les “logs” sont des messages générés par l’application pour expliquer ce qu’elle fait.

- Tous les services enregistrent leurs actions de manière claire
- Les logs sont faciles à consulter via Docker
- Leur taille est limitée pour éviter de saturer le serveur
- Chaque traitement possède un identifiant unique (`job_id`)

👉 En résumé :  
Si un problème arrive, on peut rapidement comprendre ce qu’il s’est passé.

---

## 3. 📊 Surveillance du système et expérience utilisateur

On surveille en permanence l’état du système, mais aussi ce que voit l’utilisateur.

### Côté technique
- Un tableau de bord affiche l’état général du système
- On surveille la file de tâches (Redis)
- Si trop de tâches s’accumulent, une alerte est envoyée

### Côté utilisateur
- L’utilisateur voit les étapes du traitement en direct :
  - “Scan en cours…”
  - “Extraction des données…”
  - “Finalisation…”
- Des animations de chargement rendent l’attente plus fluide

👉 En résumé :  
L’utilisateur comprend ce qui se passe au lieu d’attendre sans information.

---

## 4. 🚨 Alertes et maintenance automatique

On met en place des mécanismes pour réagir rapidement en cas de problème.

- Une alerte est envoyée sur Discord si un service ne fonctionne plus
- Les services redémarrent automatiquement en cas de crash

👉 En résumé :  
Le système se répare tout seul autant que possible, et l’équipe est immédiatement informée en cas de problème.
