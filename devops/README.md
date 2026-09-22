# DevOps — CollectionR

Documentation opérationnelle pour l'équipe Cloud/DevOps : scripts d'installation, 
manifests Kubernetes, conventions techniques.

## Convention de labels Kubernetes

Toutes les ressources Kubernetes du projet appliquent la convention standard 
`app.kubernetes.io/*`, dès le premier manifest (namespace `development`) :

| Label | Valeur | Usage |
|---|---|---|
| `app.kubernetes.io/name` | `collectionr` | Nom du projet |
| `app.kubernetes.io/part-of` | `collectionr` | Regroupement logique |
| `app.kubernetes.io/managed-by` | `kubectl` | Outil de déploiement utilisé |
| `app.kubernetes.io/component` | *(variable selon la ressource)* | Type de ressource — ex: `database` pour PostgreSQL, `backend` pour l'API. Non appliqué au namespace lui-même. |

Cette convention permet aux NetworkPolicies, ServiceAccounts et Stern de sélectionner 
les bons Pods sans ambiguïté.

Exemple sur le namespace (`devops/k3s/namespace.yaml`) :
```yaml
metadata:
  labels:
    app.kubernetes.io/name: collectionr
    app.kubernetes.io/part-of: collectionr
    app.kubernetes.io/managed-by: kubectl
```

Exemple sur un service (à partir de #11, PostgreSQL) :
```yaml
metadata:
  labels:
    app.kubernetes.io/name: collectionr
    app.kubernetes.io/part-of: collectionr
    app.kubernetes.io/managed-by: kubectl
    app.kubernetes.io/component: database
```
