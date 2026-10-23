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

# Backend (JWT)
kubectl create secret generic backend-credentials --namespace development --from-literal=JWT_SECRET="$(openssl rand -hex 32)"
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

## Volume partagé OCR (`shared-volume-ocr`)

Volume d'échange d'images entre le Backend et le Worker OCR.

- Monté **uniquement** sur 2 services :
  - **Backend** : écrit l'image envoyée par l'utilisateur.
  - **Worker OCR** : lit l'image, puis la **supprime** après traitement.
- Chemin de montage : `/data/ocr`, transmis à l'application par la variable `OCR_SHARED_DIR`.
  La valeur de la variable doit être identique au `mountPath`.
- Fichiers nommés en UUID (ex. `/data/ocr/3f2a9c1e-...`) : pas de collision entre deux scans, noms impossibles à deviner.
- Le volume n'est **pas** un stockage permanent : aucun fichier ne doit rester plus de 24h.
  Un nettoyage automatique de secours (CronJob) est prévu, au cas où un worker plante.
- Fonctionne en local (1 nœud). En Staging multi-nœuds, prévoir un stockage `ReadWriteMany`.

### Tester le volume

Deux Pods de test simulent le Backend (`test-ocr-writer`) et le Worker OCR (`test-ocr-reader`).

```bash
# 1. Lancer les Pods de test
kubectl apply -f devops/k3s/tests/test-shared-volume-ocr.yaml

# 2. Le "Backend" écrit un fichier
kubectl exec -n development test-ocr-writer -- sh -c 'echo carte > $OCR_SHARED_DIR/$(cat /proc/sys/kernel/random/uuid)'

# 3. Le "Worker" voit le fichier
kubectl exec -n development test-ocr-reader -- ls /data/ocr

# 4. Le "Worker" supprime le fichier (rien ne doit s'afficher)
kubectl exec -n development test-ocr-reader -- sh -c 'rm /data/ocr/* && ls /data/ocr'

# 5. Vérifier que seuls les 2 Pods de test utilisent le volume
kubectl describe pvc shared-volume-ocr -n development

# 6. Nettoyer (le PVC reste en place)
kubectl delete -f devops/k3s/tests/test-shared-volume-ocr.yaml
```

> ⚠️ Pour modifier le fichier de test, supprimer d'abord les Pods (`kubectl delete -f ...`) : un Pod existant ne peut pas changer de montage.