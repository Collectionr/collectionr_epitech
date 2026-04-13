

## 🛰️ Stratégie d'Observabilité & SLO - Collectionr

Cette documentation définit les standards de performance et de fiabilité pour l'infrastructure de Collectionr, en s'appuyant sur une stack **Docker** et un monitoring via **Prometheus/Grafana**

### 1. Objectifs de Niveau de Service (SLO)

Nous visons le "sweet spot" : une application fluide qui masque la complexité du traitement asynchrone par une communication transparente.

| Service | Indicateur (SLI) | Objectif (SLO) | Seuil de Performance |
| :--- | :--- | :--- | :--- |
| **Pipeline OCR** | Temps total : Envoi photo → Notification SSE | **98%** des requêtes | **2 à 5 secondes** |
| **Disponibilité API** | Taux de succès des endpoints REST | **99%** | Erreur < 1% |
| **Fiabilité SSE** | Maintien de la connexion persistante Frontend/Backend | **97%** de stabilité | Pas de déconnexion sauvage |
| **Uptime Global** | Disponibilité de l'infrastructure conteneurisée [cite: 155] | **99%** | ~7h d'indisponibilité / mois |

> **Note sur le Budget d'Erreur :** Avec un SLO à **99%**, nous nous autorisons une maintenance "propre" et des redémarrages de conteneurs sans impacter la note de qualité globale du projet.

---

### 2. Stratégie de Logging (Approche "Lean")

Faute d'outil d'agrégation type Loki, nous optimisons l'utilisation native de Docker pour garder une visibilité complète sans consommer de ressources inutiles.

* **Formatage :** Tous les services (Backend, Workers OCR, Microservice TCG) doivent logger au format **JSON structuré** dans la sortie standard (`stdout`).
* **Consultation :** Utilisation des commandes natives `docker logs -f [container_name]` pour le debugging à chaud.
* **Gestion du stockage (Crucial pour le $0) :** Configuration de la **Log Rotation** dans `daemon.json` pour éviter la saturation du disque du VPS :
    ```json
    "log-driver": "json-file",
    "log-opts": { "max-size": "10m", "max-file": "3" }
    ```
* **Traçabilité :** Le `job_id` généré par le Backend doit être systématiquement inclus dans chaque log lié au traitement d'une image pour permettre un `grep` efficace sur l'ensemble des conteneurs.

---

### 3. Monitoring & Feedback Utilisateur

L'observabilité ne sert pas qu'aux développeurs, elle nourrit aussi l'expérience utilisateur (UX).

* **Visualisation (Grafana) :** * Mise en place d'un dashboard "Health Check" surveillant la saturation de la queue **Redis**[cite: 155].
    * Si la file d'attente dépasse 10 jobs, une alerte est déclenchée pour notifier l'équipe IA d'une possible saturation des workers[cite: 122].
* **Interface Fluide :** * Le Frontend utilise les événements SSE pour afficher une progression réelle (ex: "Scan en cours...", "Extraction des données...", "Finalisation")[cite: 47, 51].
    * Utilisation de **Shimmer Loaders** pour maintenir la perception de fluidité pendant que le pipeline OCR travaille en arrière-plan[cite: 51].

---

### 4. Alerting & Maintenance Cyber

En tant qu'équipe Cloud/Cyber, notre priorité est la réactivité sur les pannes critiques[cite: 152, 153, 158].

* **Canal d'alerte :** Intégration de Grafana avec un webhook **Discord** (gratuit) pour recevoir les alertes de chute de service (Down) ou de saturation disque.
* **Auto-healing :** Configuration de la politique `restart: unless-stopped` sur tous les services Docker Compose pour garantir la résilience sans intervention manuelle immédiate[cite: 155].

---

Cette base documentaire assure que même avec un budget nul, le projet **Collectionr** présente une rigueur professionnelle lors de la soutenance finale. Est-ce que cette structure te convient pour ton livrable DevOps ?