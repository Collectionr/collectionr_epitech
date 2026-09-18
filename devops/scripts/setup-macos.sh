#!/usr/bin/env bash
# setup-macos.sh
# CollectionR - Installation K3s local sur macOS via Rancher Desktop
# A executer dans le Terminal macOS (Apple Silicon ou Intel).
#
# Ce script peut etre relance plusieurs fois sans probleme :
# il verifie a chaque etape ce qui est deja fait et ne le refait pas.
#
# NON TESTE EN CONDITIONS REELLES - a valider par un membre de l'equipe macOS
# avant fusion sur la branche principale.

set -euo pipefail

echo "========================================="
echo "  CollectionR - Installation K3s / macOS"
echo "========================================="
echo ""

echo "=== 0. Verification des outils requis ==="
if ! command -v curl &> /dev/null; then
    echo "ERREUR : 'curl' est introuvable sur ce poste."
    exit 1
fi
echo "OK - curl present."

echo ""
echo "=== 1. Verification de Homebrew ==="
if ! command -v brew &> /dev/null; then
    echo "Homebrew non trouve. Installation en cours..."
    echo "NOTE : le mot de passe administrateur (sudo) va etre demande."
    echo "       L'installation se fait en mode non-interactif (pas d'appui sur Entree requis)."
    NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    if [[ -d /opt/homebrew/bin ]]; then
        BREW_SHELLENV="/opt/homebrew/bin/brew shellenv"
    elif [[ -d /usr/local/bin ]]; then
        BREW_SHELLENV="/usr/local/bin/brew shellenv"
    else
        echo "ERREUR : Homebrew installe mais introuvable a l'emplacement attendu."
        exit 1
    fi

    eval "$($BREW_SHELLENV)"

    # Rendre brew disponible de facon permanente (pas seulement pour ce script)
    SHELL_PROFILE="$HOME/.zprofile"
    if ! grep -qF "brew shellenv" "$SHELL_PROFILE" 2>/dev/null; then
        echo "eval \"\$($BREW_SHELLENV)\"" >> "$SHELL_PROFILE"
        echo "OK - Homebrew ajoute a $SHELL_PROFILE (permanent pour les prochains terminaux)."
    fi
    echo "OK - Homebrew installe."
else
    echo "OK - Homebrew deja installe."
fi

echo ""
echo "=== 2. Installation de Rancher Desktop ==="
if ! brew list --cask rancher-desktop &> /dev/null; then
    echo "Installation de Rancher Desktop..."
    brew install --cask rancher-desktop
    echo "OK - Rancher Desktop installe."
else
    echo "OK - Rancher Desktop deja installe."
fi

echo ""
echo "=== 3. Lancement de Rancher Desktop ==="
echo "Rancher Desktop doit etre lance pour que les commandes rdctl fonctionnent."
echo ""
echo "ATTENTION : une fenetre Rancher Desktop va s'ouvrir."
echo "Au premier lancement, macOS peut aussi afficher des fenetres systeme :"
echo "  - demande d'autorisation reseau/VM -> clique 'Autoriser'"
echo "  - proposition d'installer Rosetta (Mac Apple Silicon) -> clique 'Installer'"
echo "  - conditions d'utilisation Rancher Desktop -> clique 'Accepter'"
echo "Ce script ne peut pas cliquer pour toi : reste devant l'ecran quelques minutes."
echo ""
open -a "Rancher Desktop"

echo "Attente du demarrage de l'application (jusqu'a 10 minutes, plus long au premier lancement)..."
ATTEMPTS=0
MAX_ATTEMPTS=120
until rdctl version &> /dev/null; do
    ATTEMPTS=$((ATTEMPTS + 1))
    if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
        echo "ERREUR : Rancher Desktop n'a pas demarre a temps (10 minutes ecoulees)."
        echo "Verifie si une fenetre attend une action de ta part, puis relance ce script."
        exit 1
    fi
    if [ $((ATTEMPTS % 6)) -eq 0 ]; then
        echo "Toujours en attente... ($((ATTEMPTS * 5))s ecoulees. Verifie si une fenetre attend un clic.)"
    fi
    sleep 5
done
echo "OK - Rancher Desktop est demarre."

echo ""
echo "=== 4. Activation de Kubernetes (K3s) ==="
rdctl set --kubernetes-enabled=true
echo "OK - Kubernetes active via rdctl."
echo "NOTE : l'activation peut redemarrer le moteur Kubernetes, c'est normal."

echo ""
echo "=== 5. Configuration du PATH pour les outils Rancher Desktop ==="
RD_BIN="$HOME/.rd/bin"
if [ -d "$RD_BIN" ]; then
    case ":$PATH:" in
        *":$RD_BIN:"*)
            echo "OK - $RD_BIN deja present dans le PATH de cette session."
            ;;
        *)
            echo "$RD_BIN absent du PATH de cette session, ajout temporaire..."
            export PATH="$RD_BIN:$PATH"
            ;;
    esac

    SHELL_PROFILE="$HOME/.zprofile"
    if ! grep -qF "$RD_BIN" "$SHELL_PROFILE" 2>/dev/null; then
        echo "export PATH=\"$RD_BIN:\$PATH\"" >> "$SHELL_PROFILE"
        echo "OK - $RD_BIN ajoute a $SHELL_PROFILE (permanent pour les prochains terminaux)."
    else
        echo "OK - $RD_BIN deja present dans $SHELL_PROFILE."
    fi
else
    echo "ATTENTION : $RD_BIN introuvable. Rancher Desktop a peut-etre change d'emplacement."
fi

echo ""
echo "=== 6. Verification de kubectl ==="
if ! command -v kubectl &> /dev/null; then
    echo "ERREUR : kubectl est introuvable, meme apres ajout du PATH."
    echo "Verifie manuellement : ls $RD_BIN"
    exit 1
fi
echo "OK - kubectl disponible."

echo ""
echo "=== 7. Validation finale du cluster ==="
echo "Attente de la disponibilite du noeud (jusqu'a 5 minutes, plus long au premier lancement"
echo "car les images K3s sont en cours de telechargement)..."
kubectl wait --for=condition=Ready node --all --timeout=300s

echo ""
echo "Etat des pods (tous namespaces) :"
kubectl get pods -A

echo ""
echo "========================================="
echo "  K3s (via Rancher Desktop) operationnel !"
echo "========================================="
echo ""
echo "IMPORTANT : ferme et rouvre ton terminal (ou fais 'source ~/.zprofile')"
echo "pour que 'brew' et 'kubectl' restent disponibles dans tes prochaines sessions."
echo ""
