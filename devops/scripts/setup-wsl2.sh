#!/usr/bin/env bash
# setup-wsl2.sh
# CollectionR - Installation d'un cluster K3s local sous WSL2 (Windows)
# A executer DANS le terminal Ubuntu (WSL2), pas dans PowerShell.
#
# Ce script peut etre relance plusieurs fois sans probleme :
# il verifie a chaque etape ce qui est deja fait et ne le refait pas.

set -e

echo "========================================="
echo "  CollectionR - Installation K3s / WSL2"
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
echo "=== 1. Verification de systemd ==="
if ! grep -q "systemd=true" /etc/wsl.conf 2>/dev/null; then
    echo "systemd non active. Ecriture de /etc/wsl.conf..."
    sudo bash -c 'cat >> /etc/wsl.conf << EOF

[boot]
systemd=true
EOF'
    echo ""
    echo "IMPORTANT : systemd vient d'etre active."
    echo "    1. Ferme ce terminal."
    echo "    2. Dans PowerShell (Windows), tape : wsl --shutdown"
    echo "    3. Relance Ubuntu, puis relance ce script."
    exit 0
else
    echo "OK - systemd deja active."
fi

echo ""
echo "=== 2. Mise a jour du systeme ==="
sudo apt update
sudo apt upgrade -y
echo "OK - systeme a jour."

echo ""
echo "=== 3. Verification des ports 80 et 443 (cote WSL2) ==="
echo "Traefik (inclus dans K3s) a besoin de ces ports libres."
if sudo ss -tlnp 2>/dev/null | grep -qE ':80[[:space:]]'; then
    echo "ATTENTION : le port 80 est deja utilise dans WSL2."
    sudo ss -tlnp | grep ':80'
fi
if sudo ss -tlnp 2>/dev/null | grep -qE ':443[[:space:]]'; then
    echo "ATTENTION : le port 443 est deja utilise dans WSL2."
    sudo ss -tlnp | grep ':443'
fi

if command -v powershell.exe &> /dev/null; then
    echo ""
    echo "=== 3bis. Verification des ports 80 et 443 (cote Windows) ==="
    WIN_PORT_80=$(powershell.exe -Command "Get-NetTCPConnection -LocalPort 80 -ErrorAction SilentlyContinue" 2>/dev/null || true)
    WIN_PORT_443=$(powershell.exe -Command "Get-NetTCPConnection -LocalPort 443 -ErrorAction SilentlyContinue" 2>/dev/null || true)
    if [ -n "$WIN_PORT_80" ]; then
        echo "ATTENTION : le port 80 est deja utilise cote Windows."
        echo "Traefik risque d'etre inaccessible depuis le navigateur Windows (IIS, Skype, Docker Desktop...)."
    fi
    if [ -n "$WIN_PORT_443" ]; then
        echo "ATTENTION : le port 443 est deja utilise cote Windows."
    fi
else
    echo "(powershell.exe non trouve, verification cote Windows ignoree)"
fi
echo "Verification des ports terminee (les alertes n'arretent pas le script)."

echo ""
echo "=== 4. Installation de K3s ==="
if ! command -v k3s &> /dev/null; then
    echo "Installation de K3s..."
    curl -sfL https://get.k3s.io | sh -
    echo "OK - K3s installe."
else
    echo "OK - K3s deja installe."
fi

echo ""
echo "=== 5. Verification de kubectl ==="
if ! command -v kubectl &> /dev/null; then
    echo "ERREUR : kubectl est introuvable apres installation de K3s."
    exit 1
fi
echo "OK - kubectl disponible."

echo ""
echo "=== 6. Verification du service K3s ==="
if sudo systemctl is-active --quiet k3s; then
    echo "OK - K3s est demarre."
else
    echo "ERREUR : K3s n'est pas demarre."
    sudo systemctl status k3s --no-pager
    exit 1
fi

echo ""
echo "=== 7. Configuration du kubeconfig ==="
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
echo "=== 8. Validation finale du cluster ==="
echo "Attente de la disponibilite du noeud..."
kubectl wait --for=condition=Ready node --all --timeout=60s

echo ""
echo "Etat des pods systeme (Traefik, CoreDNS, Local-path-provisioner) :"
kubectl get pods -n kube-system

echo ""
echo "========================================="
echo "  Installation K3s terminee !"
echo "========================================="
echo ""
echo "Si certains pods ne sont pas encore Running,"
echo "attends 30 secondes a 1 minute puis relance :"
echo ""
echo "    kubectl get pods -n kube-system"
echo ""
