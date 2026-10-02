# DevOps — CollectionR

Documentation opérationnelle pour l'équipe Cloud/DevOps : scripts d'installation, 
manifests Kubernetes, conventions techniques.

---

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

---
## Secrets à créer avant de déployer

Les Secrets ne sont jamais versionnés. Chaque membre les crée une fois sur son poste, **avant** les `kubectl apply`.
Les mots de passe sont générés automatiquement : personne n'a besoin de les choisir ni de les noter.

### Créer les Secrets

```bash
# PostgreSQL
kubectl create secret generic postgresql-credentials --namespace development --from-literal=POSTGRES_USER=collectionr --from-literal=POSTGRES_PASSWORD="$(openssl rand -hex 16)" --from-literal=POSTGRES_DB=collectionr_dev

# Redis OCR
kubectl create secret generic redis-ocr-credentials --namespace development --from-literal=password="$(openssl rand -hex 24)"

# Redis TCG
kubectl create secret generic redis-tcg-credentials --namespace development --from-literal=password="$(openssl rand -hex 24)"
```

### Vérifier qu'ils existent

```bash
kubectl get secrets --namespace development
```

### Relire un mot de passe (si besoin, pour lancer un service hors cluster)

```bash
# PostgreSQL
kubectl get secret postgresql-credentials --namespace development -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d; echo

# Redis OCR
kubectl get secret redis-ocr-credentials --namespace development -o jsonpath='{.data.password}' | base64 -d; echo

# Redis TCG
kubectl get secret redis-tcg-credentials --namespace development -o jsonpath='{.data.password}' | base64 -d; echo
```

> ⚠️ Ne jamais modifier le Secret PostgreSQL après le premier démarrage : la base garde l'ancien mot de passe et la connexion échoue.
> ⚠️ Toujours utiliser `-hex` (et non `-base64`) : les caractères `/`, `+`, `=` cassent les URL de connexion.
