# Documentation : Choix Technologiques & Portabilité — Projet ESP

## 1. Comparaison des fournisseurs Cloud

Pour héberger notre projet, nous avons comparé plusieurs fournisseurs. Nos critères principaux sont : le budget étudiant (très limité), les besoins en Intelligence Artificielle (IA), les tendances actuelles du marché, et la volonté de garder nos données en Europe (souveraineté).

* **AWS (Amazon) & Azure (Microsoft) :** Ce sont les géants du marché. Ils ont tout ce qu'il faut, mais leurs tarifs sont compliqués et chers pour un budget étudiant, surtout quand on déplace des données. De plus, ils sont américains, donc soumis aux lois US (Cloud Act) qui peuvent accéder aux données.
* **GCP (Google Cloud) :** Excellent pour l'IA et la gestion des mots de passe (Secret Manager). C'est très tendance, mais comme AWS, c'est américain et l'hébergement de base coûte cher.
* **Scaleway :** Un acteur français très populaire en ce moment quand on parle de "souveraineté des données". C'est moderne, les prix sont clairs et ça marche très bien avec nos outils.
* **Hetzner :** Un acteur allemand. C'est le champion du rapport puissance/prix. C'est la solution la moins chère pour louer un serveur simple (VPS) et tout installer nous-mêmes.

---

## 2. Notre choix principal

*(Note interne : Ce choix doit encore être validé avec ma collègue Cyber-sécurité pour vérifier que nos règles de réseau et d'accès sont bien respectées).*




---

## 3. Éviter d'être bloqué chez un fournisseur (Risque de dépendance / Lock-in)

Le "Vendor Lock-in", c'est quand on utilise tellement les outils spécifiques d'un fournisseur cloud (comme sa base de données maison) qu'il devient impossible ou très cher de le quitter.

Pour le projet ESP, **ce risque est presque nul** car nous faisons les choix suivants :
* **Des outils standards :** Nous utilisons une base de données PostgreSQL normale, pas une version bloquée par un fournisseur cloud.
* **Du code universel :** Nos programmes (Node.js pour l'API, Python pour l'IA) peuvent tourner sur n'importe quel ordinateur sous Linux.
* **Réseau indépendant :** C'est nous qui gérons notre réseau interne grâce à nos outils (Docker), et non le fournisseur cloud.

---

## 4. Notre stratégie pour pouvoir déménager facilement (Portabilité)



Notre but est de pouvoir recréer tout le projet chez un autre fournisseur en quelques heures si besoin. Voici comment :

1.  **L'infrastructure codée (Terraform) :** Au lieu de cliquer sur des boutons pour créer nos serveurs, nous écrivons un code qui le fait pour nous. Pour changer de fournisseur, il suffit de changer quelques lignes dans ce code.
2.  **Des serveurs "jetables" :** Nous n'installons rien manuellement sur le serveur. Si le serveur plante, on le jette et on en recrée un automatiquement avec notre code.
3.  **Des boîtes indépendantes (Conteneurs) :** Toute notre application est emballée dans des boîtes standardisées. Tant que le nouveau fournisseur accepte ces boîtes, l'application fonctionnera.

---

## 5. À quoi servent nos outils principaux ?

L'utilisation de ces trois outils est ce qui se fait de mieux aujourd'hui (très "hype" sur un CV) et nous permet de garder le contrôle.

### Terraform (L'Architecte)
* **Son rôle :** Il crée et configure le serveur à notre place.
* **Dans le projet :** C'est le seul outil qu'on utilise pour louer le serveur et configurer les règles de sécurité (qui a le droit d'entrer ou non). Comme c'est du code, on garde un historique parfait de toutes les modifications.

### Docker (Les Boîtes de transport)
* **Son rôle :** Il emballe chaque partie de l'application (le site, l'IA, la base de données) dans des environnements isolés appelés "conteneurs".
* **Dans le projet :** On l'utilise pour lancer le projet au début (le MVP). Ça permet de s'assurer que si ça marche sur l'ordinateur d'un développeur, ça marchera exactement pareil sur le serveur. Il protège aussi la base de données en la cachant d'Internet.

### Kubernetes / K3s (Le Chef d'orchestre)

* **Son rôle :** Il surveille et gère tous les conteneurs Docker de manière automatique. K3s est une version plus légère et économique de Kubernetes.
* **Dans le projet :** C'est notre objectif final. Une fois que le projet aura grandi, K3s remplacera le Docker simple. Si un morceau de l'application plante, K3s le redémarre tout seul. S'il y a beaucoup d'utilisateurs d'un coup, K3s lance automatiquement de nouveaux conteneurs d'IA pour tenir la charge.