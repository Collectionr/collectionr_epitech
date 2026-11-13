#!/usr/bin/env bash
# =============================================================================
# dev.sh — Mode code (devs Front + Back)
#
# Ouvre 2 tunnels vers les bases du cluster K3s local :
#   - PostgreSQL  -> localhost:5432
#   - Redis OCR   -> localhost:6379
#
# Front et Back tournent ensuite avec npm sur la machine (rechargement auto),
# avec un .env qui pointe sur localhost.
#
# Usage :
#   ./devops/scripts/dev.sh          # ouvre les tunnels (Ctrl+C pour tout fermer)
#   ./devops/scripts/dev.sh --help   # affiche l'aide
#
# Compatible Linux, WSL2 et macOS (bash 3.2+).
# =============================================================================

set -u

NAMESPACE="development"

# Format : "service:port_local:port_distant"
TUNNELS="postgresql:5432:5432 redis-ocr:6379:6379"

PIDS=""

# --- Couleurs (désactivées si la sortie n'est pas un terminal) ---------------
if [ -t 1 ]; then
  VERT="\033[32m"; ROUGE="\033[31m"; JAUNE="\033[33m"; RESET="\033[0m"
else
  VERT=""; ROUGE=""; JAUNE=""; RESET=""
fi

ok()     { printf "${VERT}[OK]${RESET} %s\n" "$1"; }
erreur() { printf "${ROUGE}[ERREUR]${RESET} %s\n" "$1" >&2; }
info()   { printf "${JAUNE}[INFO]${RESET} %s\n" "$1"; }

afficher_aide() {
  cat <<'EOF'
dev.sh — ouvre les tunnels du mode code.

  PostgreSQL  -> localhost:5432
  Redis OCR   -> localhost:6379

Usage :
  ./devops/scripts/dev.sh          ouvre les tunnels (Ctrl+C pour fermer)
  ./devops/scripts/dev.sh --help   affiche cette aide

Avant de lancer :
  1. K3s allumé (pas k3d) :   kubectl config current-context
  2. Cluster déployé :        ./devops/scripts/deploy.sh   (ou --light)

Ensuite, dans 2 autres terminaux :
  cd backend  && npm run start:dev
  cd frontend && npm run dev        -> http://localhost:5173
EOF
}

# --- Fermeture propre de tous les tunnels ------------------------------------
fermer_tunnels() {
  if [ -n "$PIDS" ]; then
    echo
    info "Fermeture des tunnels..."
    for pid in $PIDS; do
      kill "$pid" 2>/dev/null
    done
    wait 2>/dev/null
    ok "Tunnels fermés."
  fi
}
trap 'fermer_tunnels; exit 0' INT TERM

# --- Options ------------------------------------------------------------------
case "${1:-}" in
  -h|--help) afficher_aide; exit 0 ;;
  "") ;;
  *) erreur "Option inconnue : $1"; afficher_aide; exit 1 ;;
esac

# --- Vérification 1 : kubectl présent ----------------------------------------
if ! command -v kubectl >/dev/null 2>&1; then
  erreur "kubectl introuvable. Lance d'abord le script d'installation de ton OS."
  exit 1
fi

# --- Vérification 2 : bon cluster (K3s, pas k3d) ------------------------------
CONTEXTE="$(kubectl config current-context 2>/dev/null || true)"
if [ -z "$CONTEXTE" ]; then
  erreur "Aucun contexte kubectl. K3s est-il démarré ?"
  echo "  -> sudo systemctl status k3s   (Linux / WSL2)"
  exit 1
fi
case "$CONTEXTE" in
  k3d-*)
    erreur "Contexte actuel : $CONTEXTE (k3d). Ce script vise le cluster K3s CollectionR."
    echo "  -> k3d cluster stop <nom>"
    echo "  -> sudo systemctl start k3s"
    echo "  -> kubectl config use-context default"
    exit 1
    ;;
esac
ok "Contexte kubectl : $CONTEXTE"

# --- Vérification 3 : les services existent -----------------------------------
for tunnel in $TUNNELS; do
  service="${tunnel%%:*}"
  if ! kubectl get svc "$service" --namespace "$NAMESPACE" >/dev/null 2>&1; then
    erreur "Service '$service' absent du namespace '$NAMESPACE'."
    echo "  -> Lance d'abord : ./devops/scripts/deploy.sh --light"
    exit 1
  fi
done
ok "Services trouvés dans '$NAMESPACE'."

# --- Ouverture des tunnels -----------------------------------------------------
for tunnel in $TUNNELS; do
  service="${tunnel%%:*}"
  reste="${tunnel#*:}"
  port_local="${reste%%:*}"
  port_distant="${reste#*:}"

  kubectl port-forward "svc/$service" "$port_local:$port_distant" \
    --namespace "$NAMESPACE" --address 127.0.0.1 >/dev/null 2>&1 &
  PIDS="$PIDS $!"
done

# Laisse 2 s aux tunnels pour démarrer, puis vérifie qu'ils tiennent.
sleep 2
for pid in $PIDS; do
  if ! kill -0 "$pid" 2>/dev/null; then
    erreur "Un tunnel n'a pas démarré."
    echo "  -> Un port est peut-être déjà pris (5432 ou 6379)."
    echo "     Un PostgreSQL ou un Redis installé sur ta machine ? Un autre dev.sh ouvert ?"
    fermer_tunnels
    exit 1
  fi
done

echo
ok "Tunnels ouverts :"
echo "   PostgreSQL  -> localhost:5432"
echo "   Redis OCR   -> localhost:6379"
echo
info "Garde ce terminal ouvert. Ctrl+C pour tout fermer."

# --- Surveillance : si un tunnel tombe, on prévient et on ferme tout ----------
while true; do
  for pid in $PIDS; do
    if ! kill -0 "$pid" 2>/dev/null; then
      erreur "Un tunnel s'est fermé (Pod redémarré ?). Relance ./devops/scripts/dev.sh"
      fermer_tunnels
      exit 1
    fi
  done
  sleep 3
done