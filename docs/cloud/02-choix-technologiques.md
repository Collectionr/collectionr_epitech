# Analyse Comparative et Stratégique des Fournisseurs Cloud (Projet ESP)

Dans le cadre de notre projet de fin d'études de 18 mois (équipe de 10 personnes), notre stratégie Cloud doit soutenir nos développements tout en respectant un budget étudiant strict. Face au risque de dépendance technologique ("Vendor Lock-in") et à nos forts besoins en puissance Data/IA (3 personnes dédiées), nous avons pris une décision architecturale forte : **notre infrastructure sera conteneurisée via Docker et orchestrée sous K3s (Kubernetes allégé).**

Ce choix nous rend agnostiques sur la partie hébergement et redéfinit notre grille de lecture des fournisseurs Cloud.

## 1. Tableau Comparatif Détaillé

Le tableau ci-dessous évalue les fournisseurs selon nos critères stricts, en prenant en compte notre approche K3s.

| Fournisseur | Gratuité (Budget Étudiant) | Niveau Vendor Lock-in | Capacité IA & Data (LLM) | Complexité | Temps Setup Estimé* | Maintenance Hebdo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Microsoft Azure** | 🥇 **100$ offerts** (Sans CB). Sécurité mentale maximale. | 🟠 **Fort.** Dépendance aux SDK Azure OpenAI si intégration poussée. | ⭐⭐⭐⭐⭐<br>Accès natif à GPT-4. Idéal pour des LLM "sur étagère". | **Moyenne.** Interface dense. | **~40h - 60h** | **~1h - 3h** |
| **GCP (Google)** | 🥈 **300$ offerts** (CB requise, risque de dépassement). | 🔴 **Très Fort.** Les outils Data (BigQuery) lient fortement le code à Google. | ⭐⭐⭐⭐⭐<br>Le Roi de la Data (Vertex AI, BigQuery). | **Faible.** Interface intuitive pour les devs. | **~30h - 50h** | **~1h - 2h** |
| **AWS** | 🥉 **Free Tier 12 mois** (Coûts cachés fréquents). | 🟠 **Fort.** Écosystème très propriétaire. | ⭐⭐⭐⭐<br>Très complet (Bedrock) mais plus lourd à intégrer. | **Élevée.** Très granulaire. | **~60h - 80h** | **~2h - 4h** |
| **Scaleway** | ❌ **Pas de gratuité massive** (mais tarifs bas et transparents). | 🟢 **Faible.** Standard IaaS européen, facile d'en sortir. | ⭐⭐⭐<br>IA en développement, peu de services managés. | **Faible.** Très clair. | **~20h - 40h** | **~2h - 3h** |
| **Hetzner** | ❌ **Aucune gratuité** (mais rapport puissance/prix imbattable). | 🟢 **Nul.** Totalement agnostique. On loue du métal pur. | ⭐<br>Puissance brute uniquement (CPU/RAM). Aucune surcouche IA. | **Expert.** Tout doit être fait "from scratch". | **~80h - 100h+** | **~4h - 6h+** |
| **Oracle Cloud Infrastructure** | **Free Tier ** (mais rapport puissance/prix imbattable). | 🟢 **Faible.** Totalement agnostique. On loue du métal pur. | ⭐<br>Puissance brute uniquement (CPU/RAM). Aucune surcouche IA. | **Expert.** Tout doit être fait "from scratch". | **3 - 8h** | **~1h/mois** |

*\*Le temps de setup (pendant les 6 mois de conception) comprend la création de l'architecture, la gestion des droits (IAM), la configuration réseau et la mise en place du CI/CD.*

---

## 2. Synthèse et Choix Stratégique : L'Architecture Hybride OCI & GCP via K3s

Cette stratégie sépare l'hébergement de notre code (le Cœur) de la consommation des services intelligents (l'Edge).

### A. Le Cœur Agnostique et 100% Gratuit (Compute)
* **Le Choix :** **Oracle Cloud Infrastructure (OCI) - Offre "Always Free".**
* **Le Rôle :** Héberger notre cluster K3s qui fera tourner 100% de notre code métier (Backend, Frontend, bases de données PostgreSQL conteneurisées).
* **Les Avantages ("Hack FinOps") :**
  * **Gratuité et Performance :** OCI offre gratuitement et à vie jusqu'à 4 cœurs ARM (Ampere A1) et 24 Go de RAM. C'est une puissance inespérée pour un coût de 0€, garantissant un cluster K3s robuste pour nos 5 développeurs.
  * **Zéro Lock-in :** Le cluster K3s nous appartient. En cas de besoin, l'infrastructure peut être migrée vers un autre fournisseur IaaS très rapidement.
* **Le Défi Technique :** Les serveurs gratuits d'Oracle reposent sur une architecture ARM. L'équipe de développement devra configurer ses pipelines CI/CD pour compiler les images Docker en `linux/arm64`.

### B. L'Edge IA & Data (Services Managés & Performance)
* **Le Choix :** **Google Cloud Platform (GCP).**
* **Le Rôle :** Le pôle Data/IA ne déploiera pas de modèles d'apprentissage lourds dans notre cluster K3s sur OCI. Notre backend communiquera via des API externes sécurisées avec GCP pour les tâches d'intelligence artificielle (Vertex AI, Gemini) ou de Big Data (BigQuery).
* **Les Avantages :** * **Optimisation budgétaire absolue :** Les 300$ de crédits de bienvenue Google seront exclusivement alloués aux requêtes IA et Data. En ne payant aucun frais d'hébergement serveur chez Google, nous prolongeons considérablement la durée de vie de ces crédits.
  * **Productivité maximale :** Nos 3 experts Data profitent de la puissance de calcul massive des meilleurs outils mondiaux sans surcharger ou complexifier notre infrastructure K3s principale.

---

## 3. Impact et Plan d'Action (Pôle Cloud & Cyber)

Ce choix architectural brillant requiert une coordination et un investissement technique majeurs du binôme Cloud/Cyber lors des 6 premiers mois de conception (Cahier des charges & PoC) :

* **Action Cloud (Infrastructure as Code & CI/CD) :** * Automatisation du déploiement des serveurs OCI via Terraform et de l'installation du cluster K3s. 
  * Accompagnement de l'équipe Dev pour mettre en place un pipeline CI/CD capable de compiler les conteneurs en multi-architecture (x86 vers ARM64).
* **Action Cyber (Zero Trust & IAM) :** * Sécurisation stricte du cluster K3s (Network Policies, gestion chiffrée des secrets). 
  * Gestion des identités sur deux plateformes distinctes (OCI et GCP) et sécurisation absolue des clés API permettant à notre K3s de communiquer avec Google Cloud.
* **Contrôle Budgétaire & Réseau (Le plus critique) :** * Mise en place immédiate de *Budgets Alerts* sur GCP. 
  * Surveillance stricte de la "Data Gravity" : Google facturant le trafic sortant (Egress), l'équipe Cloud devra s'assurer que le pôle Data ne rapatrie vers OCI que des résultats légers (JSON, textes générés) et non des bases de données entières.

Ce choix architectural brillant pour le projet requiert un investissement technique majeur du binôme Cloud/Cyber lors des 6 premiers mois :

* **Action Cloud (Infrastructure as Code) :** Automatisation du déploiement des serveurs (Terraform) et de l'installation du cluster K3s (Ansible). Gestion des Ingress Controllers et du stockage persistant.
* **Action Cyber (Zero Trust) :** Sécurisation stricte du cluster. Implémentation de *Network Policies* (isolation des conteneurs), gestion chiffrée des secrets (évitant les identifiants en clair) et sécurisation des clés API permettant à K3s de communiquer avec GCP/Azure.
* **Contrôle Budgétaire :** Mise en place immédiate d'alertes de facturation (*Budgets Alerts*) sur la partie Edge (IA) pour garantir le respect de nos ressources limitées.