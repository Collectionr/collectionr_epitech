# Documentation - Triton Inference Server (pour l'OCR)

## But du document

Ce document donne une explication simple (pas trop technique) de ce qu'est Triton Inference Server et comment il peut être utilisé pour faire l'inférence du modèle OCR.

---

## 1. C'est quoi Triton Inference Server ?

Triton est un outil fait par NVIDIA. Son rôle : héberger un ou plusieurs modèles et les rendre disponibles pour qu'on puisse les appeler facilement, comme un service.

En gros : au lieu de charger le modèle dans le backend FastAPI directement, on met le modèle dans Triton, et le backend lui envoie juste une requête pour avoir le résultat.

---

## 2. Pourquoi utiliser Triton plutôt que de charger le modèle directement dans FastAPI ?

| Sans Triton (modèle chargé dans FastAPI) | Avec Triton |
|---|---|
| Le modèle tourne dans le même processus que le backend | Le modèle tourne à part, dans son propre serveur |
| Si plusieurs requêtes arrivent en même temps, ça peut ralentir | Triton gère plusieurs requêtes en même temps de façon optimisée |
| Difficile de changer de modèle sans relancer le backend | On peut changer ou mettre à jour le modèle sans toucher au backend |
| Pas optimisé pour le GPU par défaut | Triton utilise le GPU de façon efficace pour aller plus vite |

---

## 3. Comment ça marche, en gros

1. On met le modèle OCR (par exemple exporté en `.keras`, `.onnx`, ou autre format supporté) dans un dossier que Triton reconnaît
2. On démarre le serveur Triton
3. Triton charge le modèle et attend les requêtes
4. Le backend (FastAPI) envoie l'image au serveur Triton
5. Triton fait l'inférence (lecture du texte par le modèle)
6. Triton renvoie le résultat au backend
7. Le backend renvoie la réponse à l'utilisateur final

```
Utilisateur -> Backend FastAPI -> Triton Inference Server -> Modèle OCR
                                                                  |
                Utilisateur <- Backend FastAPI <- Triton <-------+
```

---

## 4. Ce qu'on doit préparer pour Triton

- Le modèle, dans un format que Triton accepte (ex: `.onnx`, `.pt`, TensorFlow SavedModel)
- Un dossier organisé d'une certaine façon (nom du modèle, version, fichier de config) — Triton a besoin de cette structure pour savoir comment charger le modèle
- Le serveur Triton lui-même, qui tourne généralement dans un conteneur (Docker)

---

## 5. Comment le backend communique avec Triton

Le backend envoie une requête à Triton (en HTTP ou en gRPC), avec l'image en entrée, et reçoit le résultat de l'OCR en retour. C'est comme appeler une API, mais c'est l'API de Triton plutôt que le modèle directement.

---

## Résumé

- Triton sert à héberger le modèle OCR à part, dans son propre serveur
- Le backend FastAPI envoie juste les images à Triton et récupère le résultat
- Avantage principal : meilleure gestion de plusieurs requêtes en même temps et meilleure utilisation du GPU
- Le modèle doit être dans un format compatible et bien rangé dans un dossier que Triton comprend
