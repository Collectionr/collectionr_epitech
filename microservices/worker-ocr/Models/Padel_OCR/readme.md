## 🎯 Objectif

À partir d'une simple photo d'un classeur Pokémon (3×3 = 9 cartes), obtenir automatiquement :
- Le **nom** de chaque carte
- Le **set** (édition) auquel elle appartient
- Le **numéro** de la carte (ex: `4/102`)

**Sans entraîner de modèle** — uniquement en assemblant des modèles pré-entraînés existants avec du post-processing intelligent.

---

## 🏗️ Architecture du système

```
Photo de classeur (JPG/PNG/WebP)
        ↓
[1] Détection des cartes (OpenCV — Hough Lines + grille math)
        ↓
9 crops de cartes individuelles
        ↓
[2] OCR sur chaque crop (PaddleOCR)
        ↓
Texte brut extrait par carte
        ↓
[3] Parsing structuré (regex + heuristiques + bounding boxes)
        ↓
{nom, HP, attaques, capacités, numéro}
        ↓
[4] Matching contre base de données (TCGdex API)
        ↓
Card ID canonique (ex: base1-4 = Charizard Base Set #4/102)
```

---

## 🧰 Stack technique

| Composant | Modèle / Outil | Rôle |
|---|---|---|
| **OCR** | PaddleOCR 3.x (`lang="en"`) | Lecture du texte sur chaque carte |
| **Framework OCR** | PaddlePaddle-GPU 3.2.2 (CUDA 12.9) | Backend GPU pour PaddleOCR |
| **Détection de cartes** | OpenCV (Canny + Hough Lines + grille math) | Trouver les 9 cartes dans la photo |
| **Extraction du nom** | Heuristiques sur bounding boxes (position + taille + filtres) | Identifier automatiquement le nom parmi tous les textes détectés |
| **Base de données** | TCGdex API (`api.tcgdex.net/v2/en`) | 50 000+ cartes référencées |
| **Fuzzy matching** | RapidFuzz | Comparer noms d'attaques/capacités |
| **HTTP** | Requests + ThreadPoolExecutor | Requêtes API parallèles |

---

## 💻 Environnement d'exécution

- **Plateforme** : Google Colab
- **GPU** : NVIDIA Tesla T4 (16 GB VRAM)
- **CUDA** : 12.8 (compatible avec le build `cu129` de PaddlePaddle)
- **Python** : 3.13

### Consommation GPU

| Étape | Utilisation GPU |
|---|---|
| Chargement de PaddleOCR | ~500 MB VRAM |
| OCR d'une carte | ~800 MB VRAM en pic |
| OCR d'une page complète (9 cartes) | ~1 GB VRAM en pic |
| **Total maximum observé** | **< 1.5 GB VRAM** |

Le pipeline utilise donc **moins de 10% des ressources d'un T4**. Il tournerait sans problème sur un GPU beaucoup plus modeste (T4 ou même sur CPU en 3-5x plus lent).

### Vitesse d'exécution

| Étape | Temps |
|---|---|
| Détection + crop des 9 cartes | < 1 s |
| OCR d'une carte | ~1-2 s |
| Matching d'une carte (cold cache) | ~1-2 s |
| Matching d'une carte (warm cache) | < 0.1 s |
| **Total pour une page complète** | **~15-25 s** |


## ✅ Points forts

- **Aucun entraînement nécessaire** — le système utilise uniquement des modèles pré-entraînés
- **OCR très robuste** : 95-100% de confiance sur les noms de cartes, même avec du reflet ou du holo
- **Extraction automatique du nom** : utilise les bounding boxes de PaddleOCR (position Y + hauteur du texte) pour identifier automatiquement quel texte est le nom de la carte, sans hardcoding
- **Toutes époques** : marche sur les cartes vintage (Base Set 1999) ET récentes (Scarlet & Violet)
- **Matching intelligent** : combine nom + HP + attaques + capacités + numéro pour désambiguïser les reprints
- **Tiebreaker canonique** : quand plusieurs candidats ont le même score, favorise les sets originaux (Base Set 1999 avant les reprints modernes)
- **Rapide** : ~15-25 s pour scanner une page complète de 9 cartes
- **Léger** : consomme moins de 1.5 GB de VRAM
- **Caching** : la 2e requête sur la même carte est instantanée (< 0.1 s)
- **Requêtes parallèles** : 32 candidats fetch en ~1 s (10 threads en parallèle)
- **100% de précision** sur les tests des classeurs vintage anglais

---

## ⚠️ Points faibles / Limitations

### Techniques

- **Détection basée sur une grille fixe** : les bornes (`top_bound`, `bottom_bound`, `left_bound`, `right_bound`) sont manuelles pour chaque photo. Une auto-détection du contour du classeur reste à faire.
- **Ambiguïté des reprints** : quand le numéro de set n'est pas lisible par l'OCR (glare, angle), le matcher peut choisir le mauvais tirage parmi 30+ Charizards identiques. Le tiebreaker "set canonique" aide mais n'est pas infaillible.
- **Numéros de set souvent manqués** : sur les cartes vintage le numéro `X/102` est écrit très petit dans la ligne de copyright, ce qui donne 6/9 détections en moyenne.
- **Aucun matching visuel** : DINOv2 était prévu mais pas encore intégré. Il résoudrait les cas où l'OCR seul ne suffit pas.

### Dépendances externes

- **API TCGdex** : le système dépend d'un service externe. Panne API = système hors service. Une solution serait de télécharger la base une fois pour tout stocker localement.


### Cas limites

- **Cartes avec glare majeur** : la Charizard Base Set avec un fort reflet perd son HP et son numéro (mais est quand même identifiée grâce au nom + attaques + capacité)
- **Grid detection non universelle** : les bornes doivent être re-calibrées si la photo est prise sous un angle différent ou avec un cadrage différent
- **Hough Lines inefficace sur fond uniforme** : quand les cartes sont posées sur une table sans binder, la détection par lignes de Hough échoue et on doit passer en mode "grille pure"

---

## 🧪 Résultats de test

Testé sur plusieurs classeurs :

### Classeur vintage anglais #1 (starters + Dark Blastoise, 9 cartes)
- Bulbasaur, Ivysaur, Venusaur, Charmander, Charmeleon, Charizard, Squirtle, Wartortle, Dark Blastoise
- **9/9 cartes correctement identifiées (100%)**

### Classeur vintage anglais #2 (Base Set Rare Holos, 9 cartes)
- Alakazam, Blastoise, Chansey, Charizard, Clefairy, Gyarados, Hitmonchan, Machamp, Magneton
- **9/9 cartes correctement identifiées (100%)** — toutes matchées à Base Set #1 à #9/102

---

## 🔮 Améliorations futures

1. **DINOv2 + FAISS** pour matching visuel — résoudrait les cas où l'OCR ne suffit pas
2. **Auto-détection des bornes du classeur** pour éliminer le calibrage manuel
3. **Dashboard HTML** pour visualiser les résultats avec images de référence et prix
4. **Base locale** téléchargée une fois pour ne plus dépendre de l'API
5. **Support 4-pocket et 12-pocket pages** en plus du 3×3

---

## 📊 Métriques finales

| Métrique | Valeur |
|---|---|
| Précision globale (classeurs vintage anglais) | **18/18 (100%)** sur 2 classeurs testés |
| Extraction automatique du nom | **17/18 (94%)** sur 2 classeurs testés |
| Temps par page complète | ~15-25 s |
| VRAM utilisée | < 1.5 GB |
| Modèles pré-entraînés utilisés | PaddleOCR + OpenCV Canny/Hough |
| Modèles entraînés à partir de zéro | Aucun |
| Lignes de code Python | ~350 |
