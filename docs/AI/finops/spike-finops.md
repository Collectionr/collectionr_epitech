# Spike FinOps — Scan de cartes Pokémon

**Objectif** : choisir un modèle pour scanner des cartes Pokémon et en extraire les infos automatiquement.

---

## Meilleur choix pour un MVP : YOLOv10 + PaddleOCR

Score de pertinence de 88%, tourne sur GPU T4 à 307$/mois. C'est le meilleur ratio coût / vitesse / simplicité de déploiement.

## Option si on veut plus de qualité : Qwen2.5-VL

Qwen2.5-VL est plus intelligent pour des cartes ambiguës mais nécessite un L4 à 491$/mois

## À éviter en première itération : DeepSeek-VL2

Nécessite un A100 80GB à 3 441$/mois, soit ~110k$ sur 32 mois. Le coût est injustifiable pour un MVP.

---

## Recommandation concrète

Pipeline en 2 niveaux :
- **Niveau 1** — YOLOv10 + OCR pour le flux standard
- **Niveau 2** — VLM (Florence-2 ou Qwen2.5-VL) uniquement sur les cartes mal lues ou ambiguës

**Benchmarker sur cartes réelles avant de décider.**

---

**GPUs compatibles par modèle — prix cloud (GCP / AWS / Lambda Labs)**

---
YOLOv10 + PaddleOCR
---
NVIDIA T4 — ~$0.35–0.45/h

NVIDIA L4 — ~$0.55–0.70/h


Qwen2.5-VL-7B
--
NVIDIA L4 24GB — ~$0.55–0.70/h

NVIDIA A10G 24GB — ~$0.75–1.00/h

olmOCR / olmOCR-2
---
NVIDIA L4 24GB — ~$0.55–0.70/h

NVIDIA A10G 24GB — ~$0.75–1.00/h

DeepSeek-VL2
---
NVIDIA A100 80GB — ~$2.50–3.50/h

NVIDIA H100 80GB — ~$3.50–5.00/h

---

> **Message clé** : le choix du GPU pèse bien plus sur le coût long terme que le nom du modèle.

-----
