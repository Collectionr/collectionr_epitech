#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Lance les services CollectionR dans le cluster K3s local
# =============================================================================
#
# Utilisation (depuis n'importe quel dossier du repo) :
#   ./devops/scripts/deploy.sh           -> profil complet
#   ./devops/scripts/deploy.sh --light   -> profil allégé (postes 8 Go de RAM)
#   ./devops/scripts/deploy.sh --status  -> affiche le mode actuel, sans rien relancer
#   ./devops/scripts/deploy.sh --help    -> aide
#
# Profil --light (Alpha) : PostgreSQL + Redis OCR + Redis TCG + Backend.
# Profil complet         : idem + Frontend (dès que frontend.yaml existe, #16).
# Les Workers (OCR, TCG) seront ajoutés en Beta.
#
# Le mode choisi est mémorisé dans le cluster (ConfigMap collectionr-profile).
# En --light, ce qui n'appartient qu'au profil complet est retiré automatiquement.
# En cas d'erreur, le script indique l'étape qui a échoué et quoi vérifier.
#
# Prérequis :
#   - K3s installé (setup-local.sh / setup-wsl2.sh / setup-macos.sh)
#   - Secrets créés (voir la section "Secrets" de devops/README.md)
#   - Image Backend construite et importée (voir la section "Backend" du README)
# =============================================================================

set -euo pipefail

NAMESPACE="development"
K3S_DIR="devops/k3s"
PROFILE_CONFIGMAP="collectionr-profile"
API_HOST="api.collectionr.localhost"

# Secrets obligatoires avant tout déploiement
REQUIRED_SECRETS=(
  "postgresql-credentials"
  "redis-ocr-credentials"
  "redis-tcg-credentials"
  "backend-credentials"
)

# Manifests du profil allégé, dans l'ordre de démarrage
LIGHT_MANIFESTS=(
  "namespace.yaml"
  "shared-volume-ocr.yaml"
  "postgresql.yaml"
  "redis-ocr.yaml"
  "redis-tcg.yaml"
  "backend.yaml"
)

# Manifests ajoutés en profil complet
FULL_EXTRA_MANIFESTS=(
  "frontend.yaml"
)

# --- Petits outils d'affichage ----------------------------------------------
info()  { echo "➡️  $*"; }
ok()    { echo "✅ $*"; }
warn()  { echo "⚠️  $*"; }
fail()  { echo "❌ $*" >&2; exit 1; }

# --- Message d'aide automatique si une commande échoue ----------------------
# Avant chaque étape, on note son nom (STEP) et quoi vérifier (HINT).
# Si une commande échoue, ce message s'affiche à la place d'une erreur brute.
STEP="démarrage du script"
HINT=""
on_error() {
  echo >&2
  echo "❌ Échec pendant : $STEP" >&2
  [ -n "$HINT" ] && echo "   👉 À vérifier : $HINT" >&2
  echo "   📒 Aide : section 'Erreurs fréquentes' de la fiche de commandes / du README d'onboarding" >&2
}
trap on_error ERR

usage() {
  sed -n '5,11p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

show_status() {
  local profile date
  profile="$(kubectl get configmap "$PROFILE_CONFIGMAP" -n "$NAMESPACE" -o jsonpath='{.data.profile}' 2>/dev/null || true)"
  date="$(kubectl get configmap "$PROFILE_CONFIGMAP" -n "$NAMESPACE" -o jsonpath='{.data.date}' 2>/dev/null || true)"
  if [ -z "$profile" ]; then
    warn "Aucun mode mémorisé : deploy.sh n'a pas encore été lancé sur ce cluster."
  else
    ok "Mode actuel : $profile (lancé le $date)"
  fi
  echo
  kubectl get pods -n "$NAMESPACE"
  exit 0
}

# Attend qu'un service soit prêt, avec un message clair s'il bloque
wait_ready() {
  local kind="$1" name="$2"
  STEP="démarrage de $name"
  HINT="kubectl get pods -n $NAMESPACE  puis  kubectl describe pod -n $NAMESPACE <le pod $name> (section Events)  ou  kubectl logs -n $NAMESPACE $kind/$name --tail=20"
  kubectl rollout status "$kind/$name" -n "$NAMESPACE" --timeout=120s
}

# --- 1. Lire les options ----------------------------------------------------
PROFILE="complet"
STATUS_ONLY="false"
for arg in "$@"; do
  case "$arg" in
    --light) PROFILE="light" ;;
    --status) STATUS_ONLY="true" ;;
    --help|-h) usage ;;
    *) fail "Option inconnue : $arg (utilise --help)" ;;
  esac
done

# --- 2. Se placer à la racine du repo, d'où qu'on lance le script -----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."
[ -d "$K3S_DIR" ] || fail "Dossier $K3S_DIR introuvable. Le script doit rester dans devops/scripts/ du repo collectionr."

# --- 3. Vérifier qu'on vise le bon cluster ----------------------------------
command -v kubectl >/dev/null 2>&1 || fail "kubectl introuvable. Installe K3s avec le script de ton OS."

CONTEXT="$(kubectl config current-context 2>/dev/null || true)"
[ -n "$CONTEXT" ] || fail "Aucun cluster actif. Démarre K3s (sudo systemctl start k3s)."

case "$CONTEXT" in
  k3d-*)
    fail "Le cluster actif est '$CONTEXT' (k3d), pas CollectionR.
   Bascule avec : kubectl config use-context default" ;;
esac
info "Cluster actif : $CONTEXT"

kubectl cluster-info >/dev/null 2>&1 || fail "Le cluster ne répond pas. K3s est-il démarré ? (sudo systemctl start k3s)"

[ "$STATUS_ONLY" = "true" ] && show_status

# --- 4. Créer le namespace en premier ---------------------------------------
STEP="création du namespace $NAMESPACE"
HINT="le fichier $K3S_DIR/namespace.yaml existe et est valide"
kubectl apply -f "$K3S_DIR/namespace.yaml" >/dev/null
ok "Namespace $NAMESPACE prêt"

# --- 5. Vérifier les Secrets (jamais dans Git, à créer sur chaque poste) ----
MISSING=()
for secret in "${REQUIRED_SECRETS[@]}"; do
  kubectl get secret "$secret" -n "$NAMESPACE" >/dev/null 2>&1 || MISSING+=("$secret")
done

if [ "${#MISSING[@]}" -gt 0 ]; then
  fail "Secrets manquants : ${MISSING[*]}
   Crée-les avec les commandes de la section 'Secrets' de devops/README.md, puis relance."
fi
ok "Secrets présents"

# --- 6. Choisir les manifests selon le profil -------------------------------
MANIFESTS=("${LIGHT_MANIFESTS[@]}")
if [ "$PROFILE" = "complet" ]; then
  for m in "${FULL_EXTRA_MANIFESTS[@]}"; do
    if [ -f "$K3S_DIR/$m" ]; then
      MANIFESTS+=("$m")
    else
      warn "$m absent : ignoré pour l'instant"
    fi
  done
fi
info "Profil : $PROFILE"

# --- 7. Appliquer les manifests ---------------------------------------------
for m in "${MANIFESTS[@]}"; do
  [ "$m" = "namespace.yaml" ] && continue
  STEP="application de $m"
  HINT="le fichier $K3S_DIR/$m existe, et son indentation YAML est correcte (test : kubectl apply -f $K3S_DIR/$m --dry-run=server)"
  kubectl apply -f "$K3S_DIR/$m"
done

# En --light : retirer ce qui n'appartient qu'au profil complet (ex. Frontend)
if [ "$PROFILE" = "light" ]; then
  for m in "${FULL_EXTRA_MANIFESTS[@]}"; do
    if [ -f "$K3S_DIR/$m" ]; then
      STEP="retrait de $m (profil light)"
      HINT="kubectl get pods -n $NAMESPACE"
      kubectl delete -f "$K3S_DIR/$m" --ignore-not-found
    fi
  done
fi

# Mémoriser le mode dans le cluster (lu par --status)
STEP="mémorisation du mode"
HINT="relance le script : cette étape ne touche pas aux services"
kubectl create configmap "$PROFILE_CONFIGMAP" -n "$NAMESPACE" \
  --from-literal=profile="$PROFILE" \
  --from-literal=date="$(date '+%d/%m/%Y %H:%M')" \
  --dry-run=client -o yaml | kubectl apply -f - >/dev/null

# --- 8. Attendre que tout soit prêt -----------------------------------------
info "Attente du démarrage (2 min max par service)..."
wait_ready statefulset postgresql
wait_ready statefulset redis-ocr
wait_ready statefulset redis-tcg

STEP="démarrage du Backend"
HINT="image importée dans K3s ? (sudo k3s crictl images | grep collectionr-backend). Sinon : kubectl logs -n $NAMESPACE deploy/backend --tail=20"
kubectl rollout status deployment/backend -n "$NAMESPACE" --timeout=120s

if [[ " ${MANIFESTS[*]} " == *" frontend.yaml "* ]]; then
  wait_ready deployment frontend
fi

# --- 9. Tester le Backend via Traefik (/health) ------------------------------
# Traefik peut mettre quelques secondes à prendre la nouvelle route : on réessaie.
info "Test du Backend (/health)..."
HEALTH_OK="false"
if command -v curl >/dev/null 2>&1; then
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    code="$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $API_HOST" http://localhost/health || true)"
    if [ "$code" = "200" ]; then HEALTH_OK="true"; break; fi
    sleep 2
  done
fi

# --- 10. Résumé --------------------------------------------------------------
echo
kubectl get pods -n "$NAMESPACE"
echo
if [ "$HEALTH_OK" = "true" ]; then
  ok "Backend répond sur /health"
else
  warn "Le Backend ne répond pas encore sur /health (ou curl est absent)."
  echo "   👉 À vérifier : Traefik tourne ? (kubectl get pods -n kube-system | grep traefik)"
  echo "   👉 Puis : kubectl logs -n $NAMESPACE deploy/backend --tail=20"
  echo "   👉 Base vide sur un nouveau poste ? Lancer les migrations Prisma (README d'onboarding)."
fi
ok "CollectionR démarré (profil $PROFILE)"
echo "   Revoir le mode plus tard : ./devops/scripts/deploy.sh --status"
