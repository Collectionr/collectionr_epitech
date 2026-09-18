#!/usr/bin/env bash
# setup-local.sh
# CollectionR - Installation d'un cluster K3s local sous Linux natif
# A executer dans un terminal Linux (Ubuntu, Debian et derives).
#
# Ce script peut etre relance plusieurs fois sans probleme :
# il verifie a chaque etape ce qui est deja fait et ne le refait pas.

set -euo pipefail

echo "========================================="
echo "  CollectionR - Installation K3s / Linux"
echo "========================================="
echo ""

echo "=== 0. Verification des outils requis ==="
for cmd in curl sudo grep; do
    if ! command -v "$cmd" &> /dev/null; then
        echo "ERREUR : '$cmd' est introuvable sur ce poste."
        echo "Installe-le avant de relancer ce script."
        exit 1
    fi
done
echo "OK - outils requis presents (curl, sudo, grep)."

echo ""
echo "=== 1. Mise a jour du systeme ==="
sudo apt update
sudo apt upgrade -y
echo "OK - systeme a jour."

echo ""
echo "=== 2. Verification des ports 80 et 443 ==="
echo "Traefik (inclus dans K3s) a besoin de ces ports libres."
if sudo ss -tlnp 2>/dev/null | grep -qE ':80[[:space:]]'; then
    echo "ATTENTION : le port 80 est deja utilise."
    sudo ss -tlnp | grep ':80'
fi
if sudo ss -tlnp 2>/dev/null | grep -qE ':443[[:space:]]'; then
    echo "ATTENTION : le port 443 est deja utilise."
    sudo ss -tlnp | grep ':443'
fi
echo "Verification des ports terminee (les alertes n'arretent pas le script)."

echo ""
echo "=== 3. Installation de K3s (embarque Traefik) ==="
if ! command -v k3s &> /dev/null; then
    echo "Installation de K3s..."
    curl -sfL https://get.k3s.io | sh -
    echo "OK - K3s installe."
else
    echo "OK - K3s deja installe."
fi

echo ""
echo "=== 4. Verification de kubectl ==="
if ! command -v kubectl &> /dev/null; then
    echo "ERREUR : kubectl est introuvable apres installation de K3s."
    exit 1
fi
echo "OK - kubectl disponible."

echo ""
echo "=== 5. Verification du service K3s ==="
if sudo systemctl is-active --quiet k3s; then
    echo "OK - K3s est demarre."
else
    echo "ERREUR : K3s n'est pas demarre."
    sudo systemctl status k3s --no-pager
    exit 1
fi

echo ""
echo "=== 6. Configuration du kubeconfig ==="
mkdir -p "$HOME/.kube"

if [ -f "$HOME/.kube/config" ]; then
    BACKUP_FILE="$HOME/.kube/config.backup.$(date +%Y%m%d%H%M%S)"
    echo "Un fichier kubeconfig existe deja. Sauvegarde en cours..."
    cp "$HOME/.kube/config" "$BACKUP_FILE"
    echo "OK - backup cree : $BACKUP_FILE"
fi

sudo cp /etc/rancher/k3s/k3s.yaml "$HOME/.kube/config"
sudo chown "$USER":"$USER" "$HOME/.kube/config"
chmod 600 "$HOME/.kube/config"
echo "OK - kubeconfig configure et securise (droits 600)."

echo ""
echo "=== 7. Validation finale du cluster ==="
echo "Attente de la disponibilite du noeud..."
kubectl wait --for=condition=Ready node --all --timeout=60s

echo ""
echo "Etat des pods (tous namespaces) :"
kubectl get pods -A

NOT_RUNNING=$(kubectl get pods -A --no-headers 2>/dev/null | grep -v -E 'Running|Completed' || true)
if [ -n "$NOT_RUNNING" ]; then
    echo ""
    echo "ATTENTION : certains pods ne sont pas Running/Completed :"
    echo "$NOT_RUNNING"
    echo "Attends 30 secondes a 1 minute puis relance : kubectl get pods -A"
    exit 1
fi

echo ""
echo "========================================="
echo "  K3s + Traefik operationnels !"
echo "========================================="
echo ""
