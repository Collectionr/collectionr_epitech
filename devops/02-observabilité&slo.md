# Suivi des performances et fiabilité — Collectionr

Ce document définit nos objectifs de service (SLO) et notre stratégie de surveillance pour garantir une plateforme robuste à coût zéro.

---

## 1. Objectifs de qualité (SLO)

Nous mesurons la santé du système via des indicateurs précis, alignés sur les besoins du PoC.

**Pipeline de Vision (OCR)**
- **Objectif :** 98% des lots de 9 images traités en moins de 15 secondes.
- **Justification :** Correspond à la capacité de traitement attendue pour une expérience fluide.

**Performance de l'API**
- **Disponibilité :** 99% de succès sur les requêtes HTTP.
- **Latence (P95) :** 95% des requêtes doivent recevoir une réponse en moins de 200 ms.
- **Justification :** Assure une navigation instantanée pour l'utilisateur final.

**Disponibilité Globale**
- **Objectif :** 99% (Uptime).
- **Maintenance :** Les interruptions pour mise à jour ne doivent pas excéder 7h/mois.

---

## 2. Gestion des logs (Traçabilité)

Dans notre architecture K3s, les logs sont éphémères. Nous devons assurer leur visibilité.

- **Standardisation :** Logs au format JSON pour faciliter une future centralisation.
- **Consultation :** Utilisation de `kubectl logs` ou d'une interface légère (type Stern) pour le débogage.
- **Identifiant :** Chaque flux (de l'upload à l'OCR) doit porter le `job_id` pour réconcilier les logs entre le Backend et les Workers.

---

## 3. Surveillance (Monitoring)

### Métriques Techniques (Prometheus/Grafana)
- État de santé des Pods (Redémarrages fréquents = problème de mémoire).
- Profondeur des files d'attente Redis (Si la file augmente, le temps de traitement OCR explose).

### Expérience Utilisateur
- Suivi du statut en temps réel via SSE (Server-Sent Events).
- Feedback visuel immédiat lors du "Batch Processing" de plusieurs cartes.

---

## 4. Alerting & Auto-réparation

- **Notifications :** Alertes critiques envoyées via Webhooks Discord (solution gratuite).
- **Self-Healing :** Utilisation des Liveness et Readiness Probes de Kubernetes pour redémarrer automatiquement les services qui ne répondent plus.
