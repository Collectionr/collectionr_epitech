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
echo "OK - liste des paquets mise a jour."
echo "NOTE : la mise a jour complete (upgrade) n'est pas forcee par ce script."
echo "       Lance 'sudo apt upgrade -y' toi-meme si tu le souhaites."

echo ""
echo "=== 2. Installation de K3s (embarque Traefik) ==="
K3S_DEJA_ACTIF=false
if sudo systemctl is-active --quiet k3s 2>/dev/null; then
    K3S_DEJA_ACTIF=true
fi

if ! command -v k3s &> /dev/null; then
    echo "Installation de K3s..."
    curl -sfL https://get.k3s.io | sh -
    echo "OK - K3s installe."
else
    echo "OK - K3s deja installe."
fi

echo ""
echo "=== 3. Verification de kubectl ==="
if ! command -v kubectl &> /dev/null; then
    echo "ERREUR : kubectl est introuvable apres installation de K3s."
    exit 1
fi
echo "OK - kubectl disponible."

echo ""
echo "=== 4. Verification du service K3s ==="
if sudo systemctl is-active --quiet k3s; then
    echo "OK - K3s est demarre."
else
    echo "ERREUR : K3s n'est pas demarre."
    sudo systemctl status k3s --no-pager
    exit 1
fi

echo ""
echo "=== 5. Verification des ports 80 et 443 ==="
if [ "$K3S_DEJA_ACTIF" = true ]; then
    echo "K3s etait deja actif avant ce script : verification des ports ignoree"
    echo "(Traefik les occupe normalement, c'est attendu)."
else
    echo "Traefik (inclus dans K3s) a besoin de ces ports libres."
    if sudo ss -tlnp 2>/dev/null | grep -qE ':80[[:space:]]'; then
        echo "ATTENTION : le port 80 est deja utilise par un autre programme."
        sudo ss -tlnp | grep ':80'
    fi
    if sudo ss -tlnp 2>/dev/null | grep -qE ':443[[:space:]]'; then
        echo "ATTENTION : le port 443 est deja utilise par un autre programme."
        sudo ss -tlnp | grep ':443'
    fi
    echo "Verification terminee (les alertes n'arretent pas le script)."
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

echo "Attente de la disponibilite des pods systeme (hors jobs deja termines)..."
kubectl wait --for=condition=Ready pods --all -n kube-system --timeout=120s --field-selector=status.phase!=Succeeded

echo ""
echo "Etat des pods (tous namespaces) :"
kubectl get pods -A

echo ""
echo "========================================="
echo "  K3s + Traefik operationnels !"
echo "========================================="
echo ""
