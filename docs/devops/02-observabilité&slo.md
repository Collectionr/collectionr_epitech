# Collectionr — Observabilité, SLO et Fiabilité Opérationnelle

## Sommaire

1. [Contexte du Projet & Objectifs d'Observabilité](#contexte-du-projet--objectifs-dobservabilité)
2. [Objectifs de Qualité de Service (SLO)](#2-objectifs-de-qualité-de-service-slo)
    * [2.1 Pipeline de Vision (OCR)](#21-pipeline-de-vision-ocr)
    * [2.2 Performance de l'API](#22-performance-de-lapi)
    * [2.3 Disponibilité Globale](#23-disponibilité-globale)
3. [Gestion des Logs et Traçabilité](#3-gestion-des-logs-et-traçabilité)
    * [3.1 Standardisation et Format](#31-standardisation-et-format)
    * [3.2 Outils de Consultation (Stern vs Grafana Loki)](#32-outils-de-consultation-stern-vs-grafana-loki)
    * [3.3 Identifiant de Corrélation](#33-identifiant-de-corrélation)
4. [Surveillance (Monitoring) & Métriques Techniques](#4-surveillance-monitoring--métriques-techniques)
    * [4.1 Métriques d'Infrastructure et Applicatives](#41-métriques-dinfrastructure-et-applicatives)
    * [4.2 Métriques de l'Expérience Utilisateur](#42-métriques-de-lexpérience-utilisateur)
5. [Alerting et Auto-réparation](#5-alerting-et-auto-réparation)
    * [5.1 Alerting et Canaux de Notification](#51-alerting-et-canaux-de-notification)
    * [5.2 Auto-réparation (Self-Healing)](#52-auto-réparation-self-healing)
    * [5.3 Restart Policies et Resource Limits](#53-restart-policies-et-resource-limits)
6. [Évolution Future de l'Observabilité](#6-évolution-future-de-lobservabilité)
7. [Conclusion](#7-conclusion)

---

## Contexte du Projet & Objectifs d'Observabilité

Le projet **Collectionr** est une plateforme de numérisation et de suivi en temps réel des cartes de collections (TCG - Trading Card Games) développée par une équipe pluridisciplinaire de 9 étudiants à Epitech Nice. L'architecture repose sur un modèle de microservices fortement découplés, où le traitement des images (OCR et inférence IA via des modèles YOLO/OpenCV sous Python) et le scraping de prix sur les places de marché sont décorrélés des appels API classiques du backend NestJS grâce à des brokers de messages Redis.

Ce découplage asynchrone, combiné à l'utilisation de volumes persistants partagés pour l'échange d'images, rend la traçabilité des requêtes et le suivi de la performance complexes. Afin de garantir le bon fonctionnement des flux de données et la stabilité globale de l'orchestrateur Kubernetes (K3s), la mise en place d'une observabilité fine est indispensable.

Ce document définit notre stratégie de surveillance, de centralisation des logs et d'auto-réparation afin de garantir le respect de nos objectifs de service (SLO) et d'assurer une résolution proactive des incidents au sein du cluster. Il sert de guide opérationnel pour l'équipe Cloud & Sécurité.

---

## 2. Objectifs de Qualité de Service (SLO)

Les SLO (Service Level Objectives) sont nos cibles de performance et de disponibilité, basés sur des indicateurs de niveau de service (SLI). Ils sont alignés sur les besoins du prototype :

### 2.1 Pipeline de Vision (OCR)
- **Objectif (SLO) :** 98% des lots de 9 images traités en moins de 15 secondes.
- **Justification technique :** L'inférence IA (Computer Vision via OpenCV/YOLO) est un traitement lourd et asynchrone. Dépasser 15 secondes dégrade fortement l'expérience utilisateur lors du scan de cartes.

### 2.2 Performance de l'API
- **Disponibilité :** 99% de réussite sur les requêtes HTTP (codes de retour 2xx et 3xx).
- **Latence (P95) :** 95% des requêtes d'API standard (hors scan) doivent recevoir une réponse en moins de 200 ms.
- **Justification technique :** Garantit une navigation rapide et fluide dans l'application web ou mobile.

### 2.3 Disponibilité Globale
- **Objectif (Uptime) :** 99% de disponibilité de la plateforme par mois.
- **Maintenance :** Les interruptions planifiées (mises à jour, migrations) ne doivent pas excéder 7 heures par mois et doivent être effectuées pendant les heures de faible trafic.

---

## 3. Gestion des Logs et Traçabilité

Dans un environnement Kubernetes (K3s), les conteneurs sont éphémères : si un pod plante et redémarre, ses logs locaux sont définitivement perdus. Nous devons donc externaliser ou structurer les logs pour conserver la traçabilité.

### 3.1 Standardisation et Format
Tous les services (Backend NestJS, Workers Python OCR, Workers TCG) doivent écrire leurs logs sur la sortie standard (`stdout`) ou d'erreur (`stderr`) au format structuré **JSON**. Cela permet à un agrégateur de logs de les analyser, filtrer et indexer efficacement.

### 3.2 Outils de Consultation (Stern vs Grafana Loki)
L'accès aux logs est adapté selon l'environnement de déploiement, en cohérence avec notre benchmark d'architecture :

- **Debug Interactif en CLI (Stern) :** 
  - *Description :* Stern est un outil en ligne de commande ultra-léger qui permet de regarder en direct les logs de plusieurs pods Kubernetes simultanément (en utilisant des expressions régulières pour filtrer par namespace ou par nom de pod).
  - *Avantages :* Évite d'installer une stack lourde en phase de développement local (K3s local). Effort et consommation de ressources nuls pour le cluster.
- **Centralisation Légère (Grafana Loki) :**
  - *Description :* Pour la phase Bêta sur VPS cloud, nous déployons **Grafana Loki** associé à Promtail (ou Grafana Agent) pour collecter et centraliser les logs du cluster.
  - *Pourquoi ce choix :* Loki est conçu pour être la stack de logs la plus légère et économique du marché. Contrairement à ELK (Elasticsearch), Loki n'indexe pas le contenu du texte des logs, mais uniquement les métadonnées (labels des pods, namespaces, etc.) et compresse le reste. Cela permet de l'exécuter sans surcharger notre VPS à bas coût (20-40 €/mois), préservant ainsi nos contraintes budgétaires.

### 3.3 Identifiant de Corrélation
Pour suivre un flux d'exécution complexe (par exemple, un utilisateur qui envoie une photo de carte) :
1. L'API backend génère un `job_id` lors de la réception de la photo.
2. Ce `job_id` est poussé dans la file d'attente Redis OCR avec la tâche de scan.
3. Le Worker Python OCR lit la tâche et génère ses logs en y incluant ce `job_id`.
4. En cas d'erreur de traitement, le binôme DevOps peut rechercher le `job_id` dans Loki et réconcilier instantanément les logs du backend NestJS avec ceux du worker Python.

---

## 4. Surveillance (Monitoring) & Métriques Techniques

La surveillance quantitative repose sur le couple **Prometheus** (collecteur de métriques temporelles) et **Grafana** (tableaux de bord).

### 4.1 Métriques d'Infrastructure et Applicatives
Pour assurer le respect de nos SLOs et prévenir les pannes, nous surveillons en continu les indicateurs techniques suivants :

- **État de santé des Pods (K3s) :**
  - *Métriques :* `kube_pod_container_status_restarts_total` (nombre de redémarrages d'un conteneur) et statut du pod (`CrashLoopBackOff`, `OOMKilled`, `Error`).
  - *Justification :* Les runtimes Python d'IA (OpenCV/YOLO) peuvent présenter des fuites de mémoire. Si le nombre de restarts d'un pod augmente, cela signale un problème applicatif ou de sous-dimensionnement des ressources.
- **Profondeur des files d'attente Redis (Redis OCR & Redis TCG) :**
  - *Métriques :* Taille des listes Redis de tâches en attente (`llen`).
  - *Justification :* Si la file d'attente Redis OCR s'accumule, le temps d'attente des utilisateurs augmente et notre SLO de 15 secondes sera dépassé. Cette métrique servira également de déclencheur pour l'autoscaling horizontal (HPA) à long terme. Si la file Redis TCG s'accumule, cela montre une saturation du worker de scraping.
- **Espace disque du Shared Volume OCR :**
  - *Métriques :* Utilisation de l'espace de stockage persistant (PVC Kubernetes) utilisé pour stocker temporairement les images brutes envoyées par les utilisateurs.
  - *Justification :* Les images brutes s'accumulent vite. Si le disque sature, l'API `/scan` plantera immédiatement. Cette métrique permet d'alerter sur une défaillance de la tâche Cron de purge automatique des images.
- **Latence et Taux d'Erreurs API :**
  - *Métriques :* Taux d'erreurs HTTP 5xx et latence des requêtes P95, mesurés via les métriques Ingress (Traefik ou Nginx Ingress Controller).

### 4.2 Métriques de l'Expérience Utilisateur
- Suivi du statut de traitement en temps réel via SSE (Server-Sent Events) côté client.
- Suivi du temps de chargement initial (Lighthouse > 80, chargement de l'application < 3s).

---

## 5. Alerting et Auto-réparation

### 5.1 Alerting et Canaux de Notification
Prometheus Alertmanager gère les règles d'alertes.
- **Canal de notification :** Les alertes critiques (Shared Volume saturé à plus de 85%, Pod en CrashLoopBackOff depuis 5 minutes, Redis injoignable) sont envoyées à l'équipe via des **Webhooks Discord**.
- *Justification :* Discord est une solution de communication gratuite et performante, éliminant tout coût lié à des outils payants comme PagerDuty ou Opsgenie.

### 5.2 Auto-réparation (Self-Healing)
Kubernetes assure la résilience du cluster via les sondes de santé configurées pour chaque Pod :

- **Liveness Probe (Sonde de vie) :**
  - *Rôle :* Déterminer si l'application dans le conteneur est bloquée (boucle infinie, freeze du thread principal).
  - *Action :* Si la liveness probe échoue à plusieurs reprises, le Kubelet tue le conteneur et le redémarre selon sa politique de redémarrage.
- **Readiness Probe (Sonde de préparation) :**
  - *Rôle :* Déterminer si le conteneur est prêt à recevoir du trafic (par exemple, après avoir établi ses connexions à PostgreSQL et Redis).
  - *Action :* Si elle échoue, le Pod est retiré du pool du service de routage Kubernetes (Ingress/ClusterIP), évitant d'envoyer des requêtes utilisateurs vers un pod incapable de répondre.

### 5.3 Restart Policies et Resource Limits
Pour éviter que l'instabilité inhérente aux workers d'IA ou de scraping ne fasse planter tout le serveur, nous configurons des barrières strictes :

- **Restart Policy (`Always`) :**
  - *Spécification :* Tous les déploiements applicatifs de Collectionr possèdent la directive `restartPolicy: Always`.
  - *Justification :* Garantit que Kubernetes recréera instantanément le Pod s'il s'arrête suite à une exception non gérée dans le code ou s'il est stoppé par le système.
- **Resource Limits & Requests (CPU/RAM) :**
  - Chaque manifeste Kubernetes doit spécifier des limites (`limits`) et des demandes minimales (`requests`) en CPU et mémoire.
  - *Exemple type pour le Worker Python OCR :*
    ```yaml
    resources:
      requests:
        memory: "512Mi"
        cpu: "250m"
      limits:
        memory: "2Gi"
        cpu: "1000m"
    ```
  - *Justification technique (Comportement OOMKilled) :* Sans limites de ressources, une fuite de mémoire dans un script Python IA pourrait consommer toute la RAM du serveur VPS unique (SPOF) et provoquer le crash complet de la machine hôte. Avec une limite configurée (ex: 2Gi RAM), si le worker dépasse cette valeur, le noyau Linux déclenche un signal d'extinction propre (**OOMKilled**). Kubernetes isole le conteneur défaillant, le détruit et en recrée un sain en moins de deux secondes grâce à la Restart Policy `Always`, assurant la continuité de service des autres composants (Backend, Redis, PostgreSQL).

---

## 6. Évolution Future de l'Observabilité

La stack d'observabilité de Collectionr évolue de façon cohérente avec les environnements décrits dans notre benchmark :

```text
[ Dev / Local ] -----------------> [ Bêta / VPS ] --------------------> [ Production / K8s Managé ]
• kubectl / Stern                  • Loki + Prometheus Self-Hosted      • Prometheus/Grafana Cloud (Free Tier)
• Logs stdout JSON                 • Alerting Discord Webhooks          • Autoscaling horizontal (HPA) via KEDA
• Empreinte : Matériel local       • CPU/RAM VPS : Allocation minimale  • Services de monitoring managés
```

### Phase 1 : K3s Local (Prototype)
- On évite d'installer Prometheus/Grafana en local pour économiser la RAM des machines de développement.
- Utilisation de **Stern** et des commandes CLI standards pour le debug interactif.

### Phase 2 : K3s VPS (Bêta - ~1 000 Utilisateurs)
- Déploiement de **Grafana Loki** (centralisation des logs) et du stack léger `kube-prometheus-stack` (Prometheus et Grafana self-hosted) via des charts Helm.
- Configuration des alertes Prometheus transmises vers Discord.
- Analyse continue de l'utilisation disque du Shared Volume OCR pour calibrer la tâche de purge.

### Phase 3 : Kubernetes Managé (Production - >10 000 Utilisateurs)
- Migration vers des offres de monitoring managées (telles que le Free Tier de Grafana Cloud ou les outils natifs du fournisseur de cloud) pour découpler la surveillance de l'infrastructure de production.
- **Autoscaling piloté par les métriques (KEDA / HPA) :** Utilisation des métriques Prometheus de profondeur de file d'attente Redis OCR comme déclencheur pour l'autoscaling horizontal. Si le nombre de scans en attente dépasse un seuil, de nouveaux workers OCR sont automatiquement créés sur des nœuds cloud temporaires, puis détruits lorsque la file d'attente se vide, optimisant ainsi le budget FinOps de production.

---

## 7. Conclusion

Ce plan d'observabilité concilie les exigences de performance de Collectionr avec la complexité opérationnelle d'une architecture en microservices asynchrones. En s'appuyant sur des outils open-source éprouvés (Stern, Grafana Loki, Prometheus) et sur les mécanismes natifs de Kubernetes (Probes de santé, Restart Policies, Resource Limits), nous garantissons une détection proactive des anomalies et une résilience robuste du système, sécurisant la transition de la plateforme du développement local vers les phases cloud.
