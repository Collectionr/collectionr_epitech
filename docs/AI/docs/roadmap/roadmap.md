# Roadmap — Extraction de cartes Pokémon par IA

---

## Étape 1 — Étude des datasets

Récupération et analyse des datasets Pokémon existants.
Exploration des données, nettoyage, statistiques descriptives.
Résultats publiés sur GitHub sous forme de notebooks Jupyter (`.ipynb`) accompagnés d'un rapport.

---

## Étape 2 — Post-processing & benchmark des modèles

Sélection des modèles candidats : YOLOv10+PaddleOCR, Florence-2, Qwen2.5-VL, olmOCR.
Test de chaque modèle sur des cartes réelles pour mesurer la pertinence en conditions concrètes.
Un rapport de benchmark dédié par modèle, publié sur GitHub.

---

## Étape 3 — Validation ou fine-tuning

Décision basée sur les résultats du benchmark.
Si les performances sont suffisantes → validation et passage à l'étape suivante.
Si les performances sont insuffisantes → fine-tuning du modèle retenu sur les données Pokémon.

---

## Étape 4 — Implémentation & tests d'inférence

Containerisation de la solution dans Docker.
Écriture de scripts de test pour valider l'inférence bout en bout.
Mesure des temps de réponse et stabilité en environnement isolé.
