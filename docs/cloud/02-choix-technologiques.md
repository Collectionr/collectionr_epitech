# 🌐 Choix des solutions Cloud — Collectionr

Ce document présente l'évolution de notre stratégie d'infrastructure, passant d'un modèle multi-cloud gratuit à une architecture souveraine basée sur K3s pour la phase de prototypage.

---

## 1. 🏗️ Phase de Prototypage : L'ère K3s

### 📊 Comparaison des environnements de prototypage

| Solution | Coût | Complexité | Parité Prod | Maintenance | Usage recommandé |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Docker Compose** | 0 € | Très Faible | Faible | Manuelle | Debug rapide de services isolés |
| **K3s Local** | 0 € | Moyenne | Élevée | Équipe | Développement et tests d'intégration |
| **K3s + VPS** | 5-15 € / mois | Moyenne | Élevée | Équipe | Prototype partagé et tests utilisateurs |
| **K8s Managé** | 40 €+ / mois | Faible | Maximale | Hébergeur | Phase de Production (Cible finale) |

### 💻 Étape 1 : K3s Local 
Le développement commence par l'installation de K3s sur les postes locaux ou un serveur de test interne.

*   **Besoin :** Disposer d'un environnement identique à la production sans aucun coût.
*   **Solution :** Utiliser K3s (version légère de Kubernetes) pour orchestrer les microservices localement.
*   **Pourquoi ce choix :** K3s consomme très peu de ressources (moins de 512 Mo de RAM pour le plan de contrôle), ce qui le rend idéal pour des machines de développement.

### 🌐 Étape 2 : K3s + VPS 
Une fois le prototype local stabilisé, nous migrons vers un **VPS (Virtual Private Server)**.

*   **Besoin :** Rendre l'application accessible via Internet pour les tests utilisateurs et l'équipe.
*   **Solution :** Installation de K3s sur un VPS d'entrée de gamme.
*   **Pourquoi ce choix :** Un VPS offre une IP publique fixe et une disponibilité 24/7 pour un coût très faible (env. 5-10€/mois), tout en conservant la main totale sur l'OS et l'orchestrateur.

---

## 2. 🛠️ Rôle de Docker et Kubernetes 

Durant cette phase, ces deux technologies jouent des rôles complémentaires mais distincts :

*   **Docker :** Utilisé pour la **conteneurisation**. Il permet d'empaqueter chaque microservice (Node.js, Python, Scrapers) avec ses dépendances dans une image immuable. Cela garantit que "ça marche sur ma machine" signifie "ça marchera sur le serveur".
*   **Kubernetes (K3s) :** Utilisé pour l'**orchestration**. Son rôle est de gérer le cycle de vie des conteneurs : démarrage, redémarrage automatique en cas de crash, gestion du réseau interne (DNS, Services) et exposition des APIs via un Ingress Controller.

---

## 3. 🚀 Stratégie de Portabilité 

Pour éviter de rester bloqué chez un hébergeur, nous appliquons une stratégie de portabilité stricte :

1.  **Manifestes Standards :** Utilisation de fichiers YAML Kubernetes standards. Aucune ressource spécifique à un fournisseur (comme un LoadBalancer propriétaire) n'est utilisée.
2.  **Images Multi-Arch :** Construction d'images Docker compatibles x86 et ARM pour pouvoir basculer entre différents types de serveurs sans recompilation.
3.  **Abstraction du Stockage :** Utilisation de classes de stockage standards pour rester compatible avec n'importe quel fournisseur de volumes persistants.

---

## 4. ⚖️ Risques et Dépendances (Vendor Lock-in)

L'utilisation de K3s auto-hébergé réduit drastiquement le risque de **Vendor Lock-in**.

*   **Risque Faible :** Le code et l'infrastructure sont portables. Si un hébergeur augmente ses prix ou ferme ses services, la migration vers un autre VPS se résume à une réinstallation de K3s (automatisable) et au déploiement des manifestes.
*   **Indépendance :** Nous ne dépendons pas des services propriétaires (DB managée, Auth managée) des "Big Cloud" (AWS/GCP/Azure).

---

## 5. 🔮 Phase de Production : Vers le Cloud Managé

Pour le passage en production réelle (scalabilité, haute disponibilité, support 24/7), nous prévoyons de basculer vers un **Kubernetes Managé**.

### Fournisseurs identifiés
Nous privilégierons des acteurs offrant un bon rapport performance/prix et une souveraineté des données :

1.  **Scaleway (Kapsule) :** Excellent support Kubernetes en France, interface simple et prix compétitifs.
2.  **OVHcloud (Managed Kubernetes) :** Solution souveraine, infrastructure robuste, idéal pour la conformité européenne.
3.  **DigitalOcean (LKS) :** Très simple à mettre en œuvre, idéal pour un déploiement international rapide.

### Pourquoi ce choix pour la production ?
Le passage au managé permet de déléguer la maintenance du "Control Plane" au fournisseur, permettant à l'équipe de se concentrer uniquement sur les fonctionnalités métier tout en garantissant un SLA (niveau de service) élevé.

---

## ✅ Conclusion

Cette stratégie garantit une **maîtrise totale des coûts** pour le prototype tout en préparant techniquement le projet à une **montée en charge industrielle**. L'utilisation de K3s dès le départ évite toute refonte majeure lors du passage au Cloud managé.
