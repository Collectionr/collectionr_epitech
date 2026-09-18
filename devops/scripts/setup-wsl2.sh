#!/bin/bash
# setup-wsl2.sh
# CollectionR — Installation K3s local sous WSL2 (Windows)
# À exécuter DANS le terminal Ubuntu (WSL2), pas dans PowerShell.
#
# Tu peux relancer ce script plusieurs fois sans problème :
# il vérifie à chaque étape ce qui est déjà fait et ne le refait pas.

set -e  # arrête le script à la première erreur

echo "=== 1. Vérification de systemd ==="
if ! grep -q "systemd=true" /etc/wsl.conf 2>/dev/null; then
    echo "systemd non activé, écriture de /etc/wsl.conf..."
    sudo bash -c 'cat >> /etc/wsl.conf << EOF

[boot]
systemd=true
EOF'
    echo ""
    echo "⚠️  IMPORTANT : systemd vient d'être activé."
    echo "    1. Ferme ce terminal."
    echo "    2. Dans PowerShell (Windows), tape : wsl --shutdown"
    echo "    3. Relance Ubuntu, puis relance ce script."
    exit 0
else
    echo "systemd déjà activé, on continue."
fi

echo "=== 2. Mise à jour du système ==="
sudo apt update && sudo apt upgrade -y

echo "=== 3. Installation de K3s ==="
if ! command -v k3s &> /dev/null; then
    curl -sfL https://get.k3s.io | sh -
else
    echo "K3s déjà installé, on passe."
fi

echo "=== 4. Vérification du service K3s ==="
sudo systemctl status k3s --no-pager

echo "=== 5. Configuration propre du kubeconfig ==="
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown "$USER":"$USER" ~/.kube/config

echo "=== 6. Export KUBECONFIG permanent (idempotent) ==="
if ! grep -q "export KUBECONFIG=~/.kube/config" ~/.bashrc; then
    echo 'export KUBECONFIG=~/.kube/config' >> ~/.bashrc
    echo "Ligne ajoutée à ~/.bashrc."
else
    echo "Déjà présent dans ~/.bashrc, rien à faire."
fi
export KUBECONFIG=~/.kube/config

echo "=== 7. Vérification finale du cluster ==="
kubectl get pods -A

echo ""
echo "✅ Installation terminée."
echo "   Si des pods ne sont pas encore 'Running', attends 30s-1min et relance :"
echo "   kubectl get pods -A"
