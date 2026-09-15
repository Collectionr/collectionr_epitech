# Évaluation des Modèles Step par Step / Extraction de Cartes Pokémon

> **Étape 2 — Benchmark des modèles candidats**  
> Modèles couverts : YOLOv10+PaddleOCR · Florence-2 · Qwen2.5-VL · olmOCR

---

## Table des matières

1. [Contexte & objectifs](#1-contexte--objectifs)
2. [Métriques communes à tous les modèles](#2-métriques-communes-à-tous-les-modèles)
3. [YOLOv10 + PaddleOCR](#3-yolov10--paddleocr)
4. [Florence-2](#4-florence-2)
5. [Qwen2.5-VL](#5-qwen25-vl)
6. [olmOCR](#6-olmocr)
7. [Tableau comparatif des métriques par modèle](#7-tableau-comparatif-des-métriques-par-modèle)
8. [Protocole de test](#8-protocole-de-test)
9. [Seuils de décision (Étape 3)](#9-seuils-de-décision-étape-3)
   - 9.1 [Seuils pour le scan de plusieurs cartes (batch)](#91-seuils-pour-le-scan-de-plusieurs-cartes-batch)

---

## 1. Contexte & objectifs

La tâche consiste à extraire des informations structurées depuis une image de carte Pokémon réelle :

- **Nom** de la carte
- **HP / Points de vie**
- **Type(s)** (Feu, Eau, Plante…)
- **Attaques** (nom, coût en énergie, dégâts)
- **Numéro de carte** et **édition**
- **Rareté** (symbole ou texte)

Chaque modèle aborde cette tâche différemment (pipeline de détection + OCR, VLM généraliste, OCR spécialisé), ce qui implique des métriques d'évaluation adaptées à chaque architecture.

---

## 2. Métriques communes à tous les modèles

Ces métriques s'appliquent quelle que soit l'architecture testée, car elles mesurent la qualité de l'extraction finale.

### 2.1 Qualité de l'extraction textuelle

| Métrique | Description | Formule / outil |
|---|---|---|
| **CER** (Character Error Rate) | Taux d'erreur au niveau caractère | `(S+D+I) / N` (Levenshtein) |
| **WER** (Word Error Rate) | Taux d'erreur au niveau mot | Idem, sur les tokens |
| **Exact Match (EM)** | % de champs extraits identiques à la GT | `correct_fields / total_fields` |
| **Field-level F1** | Précision/Rappel par champ (nom, HP, type…) | F1 par champ, puis moyenne |

> **Priorité** : Exact Match sur les champs critiques (nom, HP, numéro de carte). CER/WER pour diagnostiquer les erreurs de transcription fine.

### 2.2 Complétude de l'extraction

| Métrique | Description |
|---|---|
| **Field Coverage** | % de champs obligatoires extraits (non-nuls) |
| **Hallucination Rate** | % de champs retournés qui n'existent pas dans la GT |
| **Structured Output Validity** | Le JSON/dict retourné est valide et parseable |

### 2.3 Performance & coût

| Métrique | Description |
|---|---|
| **Latence (ms/image)** | Temps de bout en bout par carte |
| **Throughput (images/sec)** | Débit en traitement batch |
| **VRAM utilisée (GB)** | Pic mémoire GPU lors de l'inférence |
| **CPU/RAM** | Pour les modèles sans GPU |

### 2.4 Robustesse

| Scénario | Description |
|---|---|
| Carte en biais (rotation 5°–20°) | Résistance aux images mal cadrées |
| Faible résolution (< 300px de hauteur) | Photos floues ou compressées |
| Reflet / surexposition | Conditions d'éclairage défavorables |
| Carte abîmée / partiellement illisible | Usure physique |
| Carte non-latine (japonaise, coréenne) | Internationalisation |

---

## 3. YOLOv10 + PaddleOCR

### Architecture

Pipeline en deux étapes :
1. **YOLOv10** détecte et localise les zones d'intérêt (bounding boxes) sur la carte
2. **PaddleOCR** transcrit le texte dans chaque zone découpée

### Métriques spécifiques

#### Détection (YOLOv10)

| Métrique | Description | Seuil cible |
|---|---|---|
| **mAP@0.5** | Mean Average Precision, IoU > 0.5 | ≥ 0.85 |
| **mAP@0.5:0.95** | mAP sur plusieurs seuils d'IoU | ≥ 0.70 |
| **Recall par classe** | Rappel par zone (nom, HP, type, attaque…) | ≥ 0.90 |
| **IoU moyen** | Chevauchement boîte prédite / GT | ≥ 0.80 |
| **False Negative Rate** | Zones manquées (zone non détectée) | ≤ 0.10 |

> La qualité de détection conditionne directement la qualité OCR : une zone mal découpée entraîne une transcription dégradée.

#### OCR (PaddleOCR)

| Métrique | Description |
|---|---|
| **CER par zone** | Erreur de transcription dans chaque région |
| **WER par zone** | Idem au niveau mot |
| **Confidence score moyen** | Score de confiance interne PaddleOCR |
| **Taux de rejet** | % de zones où PaddleOCR retourne une chaîne vide |

#### Pipeline global

| Métrique | Description |
|---|---|
| **End-to-End Exact Match** | Champ correct de bout en bout (détection + OCR) |
| **Propagation d'erreur** | Mesure combien de % des erreurs finales viennent de la détection vs. de l'OCR |

### Points de vigilance

- Sensible à la qualité des **annotations de bounding boxes** dans le dataset de test
- Les cartes avec des **layouts non standards** (ex : cartes EX, V, VMAX) peuvent casser la détection si le modèle YOLO n'a pas été entraîné dessus
- PaddleOCR gère mal les **fontes stylisées** (ex : noms d'attaques avec effets graphiques)

---

## 4. Florence-2

### Architecture

Modèle VLM (Vision-Language Model) de Microsoft, capable de répondre à des prompts visuels structurés. Utilisé ici en mode **zero-shot ou few-shot** pour extraire les champs en une seule passe.

### Métriques spécifiques

#### Qualité de génération

| Métrique | Description | Seuil cible |
|---|---|---|
| **Field-level Exact Match** | Champ extrait = valeur GT | ≥ 0.75 |
| **Field-level F1** | Précision/Rappel par champ | ≥ 0.80 |
| **Partial Match Score** | Correspondance partielle (ex : "Pikachu" vs "Pikachu V") | Métrique custom |
| **Hallucination Rate** | Champs inventés absents de la carte | ≤ 0.05 |

#### Qualité du prompt

| Métrique | Description |
|---|---|
| **Prompt Sensitivity** | Variation du EM selon la formulation du prompt |
| **Few-shot Gain** | Delta EM entre 0-shot et 3-shot |
| **JSON Validity Rate** | % de réponses correctement parseable en JSON |

#### Localisation (si utilisé en mode grounding)

| Métrique | Description |
|---|---|
| **Grounding Accuracy** | Les bounding boxes générées correspondent aux bonnes zones |
| **Referring Expression Accuracy** | Florence-2 identifie la bonne zone quand on lui demande "Où est le HP ?" |

### Points de vigilance

- La qualité dépend fortement du **wording du prompt** — tester plusieurs formulations
- Tendance à **paraphraser** plutôt que transcrire mot-pour-mot (problématique pour les noms propres)
- Performance dégradée sur les **chiffres** (HP, dégâts d'attaque) en zero-shot

---

## 5. Qwen2.5-VL

### Architecture

VLM multimodal d'Alibaba, optimisé pour la compréhension fine de documents et d'images avec texte dense. Disponible en plusieurs tailles (3B, 7B, 72B).

### Métriques spécifiques

#### Extraction structurée

| Métrique | Description | Seuil cible |
|---|---|---|
| **Field-level Exact Match** | Correspondance exacte par champ | ≥ 0.80 |
| **Numeric Accuracy** | Exactitude sur les champs numériques (HP, dégâts) | ≥ 0.90 |
| **Entity Recognition Score** | Nom de carte, type, édition correctement identifiés | ≥ 0.85 |
| **Structured Output Rate** | % de réponses retournant un JSON valide | ≥ 0.95 |

#### Compréhension du layout

| Métrique | Description |
|---|---|
| **Reading Order Accuracy** | Les informations sont extraites dans le bon ordre logique |
| **Multi-block Coherence** | Les attaques (multi-lignes) sont correctement groupées |
| **Table/List Parsing** | Les listes d'énergie et coûts sont bien structurées |

#### Comparaison de tailles de modèle

| Taille | EM attendu | Latence | VRAM |
|---|---|---|---|
| Qwen2.5-VL-3B | Baseline | ~500ms | ~8 GB |
| Qwen2.5-VL-7B | +10–15% vs 3B | ~1.2s | ~18 GB |
| Qwen2.5-VL-72B | Référence max | ~8s | ~80 GB |

> Recommandation : benchmarker 3B et 7B en priorité pour trouver le meilleur ratio performance/coût.

### Points de vigilance

- Excellent sur le **texte dense et structuré**, mais peut sur-interpréter les symboles graphiques (icônes de type)
- Vérifier la gestion des **caractères spéciaux** (ex : symboles d'énergie stylisés)
- Le mode **instruction-following** est crucial : tester avec un system prompt strict imposant le format JSON

---

## 6. olmOCR

### Architecture

Modèle OCR spécialisé dans l'extraction de documents, développé par l'Allen Institute for AI. Optimisé pour les documents structurés multi-colonnes et les PDFs, adapté ici aux cartes scannées.

### Métriques spécifiques

#### Fidélité de transcription

| Métrique | Description | Seuil cible |
|---|---|---|
| **CER global** | Erreur caractère sur l'ensemble du texte de la carte | ≤ 0.05 |
| **WER global** | Erreur mot sur l'ensemble du texte de la carte | ≤ 0.08 |
| **Line-level Accuracy** | % de lignes transcrites sans erreur | ≥ 0.90 |
| **Number Transcription Accuracy** | Exactitude sur HP, dégâts, numéros | ≥ 0.95 |

#### Structuration du texte

| Métrique | Description |
|---|---|
| **Layout Preservation** | Le texte est retourné dans un ordre logique reflétant la structure de la carte |
| **Block Segmentation Score** | Les blocs distincts (nom, attaques, flavor text) sont bien séparés |
| **Post-processing Effort** | Nombre de règles regex nécessaires pour parser la sortie brute |

#### Robustesse OCR

| Scénario | Métrique |
|---|---|
| Fontes stylisées (noms d'attaques) | CER spécifique aux zones stylisées |
| Texte sur fond texturé | Taux d'erreur sur le flavor text |
| Petit texte (numéro de carte, édition) | CER sur les zones à petite police |

### Points de vigilance

- olmOCR retourne du **texte brut** sans structuration sémantique : une étape de **post-processing** (regex ou parser) est obligatoire
- Mesurer le **coût total** en incluant le temps de post-processing dans la latence
- Moins adapté aux **zones purement graphiques** (icônes de type, symboles de rareté)

---

## 7. Tableau comparatif des métriques par modèle

| Métrique | YOLOv10+PaddleOCR | Florence-2 | Qwen2.5-VL | olmOCR |
|---|---|---|---|---|
| Exact Match (champs clés) | ✅ Prioritaire | ✅ Prioritaire | ✅ Prioritaire | ⚠️ Via post-processing |
| CER / WER | ✅ Par zone OCR | ➖ Secondaire | ➖ Secondaire | ✅ Prioritaire |
| mAP détection | ✅ Critique | ➖ N/A | ➖ N/A | ➖ N/A |
| Hallucination Rate | ➖ N/A | ✅ Critique | ✅ Critique | ➖ N/A |
| JSON Validity Rate | ✅ Post-process | ✅ Critique | ✅ Critique | ⚠️ Après parsing |
| Latence (ms/image) | ✅ Tous | ✅ Tous | ✅ Tous | ✅ Tous |
| VRAM | ~4–6 GB | ~8–16 GB | 8–80 GB | ~8–16 GB |
| Robustesse (rotation, flou) | ⚠️ Sensible | ✅ Bonne | ✅ Très bonne | ⚠️ Sensible |
| Internationalisation (JP/KR) | ✅ PaddleOCR fort | ⚠️ Limitée | ✅ Native | ⚠️ Limitée |

---

## 8. Protocole de test

### 8.1 Dataset de test

Constituer un jeu de test **annoté manuellement** avec :

- **50 cartes minimum**, couvrant :
  - Cartes de base (layout simple)
  - Cartes EX / V / VMAX / ex (layouts complexes)
  - Cartes abîmées ou avec reflets (au moins 10)
- **Ground Truth (GT)** : JSON par carte avec tous les champs attendus
- Résolutions variées : 300px, 600px, 1200px de hauteur

### 8.2 Format de la Ground Truth

```json
{
  "card_id": "pikachu_base_58",
  "name": "Pikachu",
  "hp": 40,
  "type": ["Lightning"],
  "attacks": [
    { "name": "Thunder Shock", "cost": ["Lightning"], "damage": 10, "effect": "Flip a coin." },
    { "name": "Agility", "cost": ["Lightning", "Colorless"], "damage": 20, "effect": null }
  ],
  "card_number": "58/102",
  "set": "Base Set",
  "rarity": "Common",
  "illustrator": "Mitsuhiro Arita"
}
```

### 8.3 Procédure d'évaluation

1. Passer chaque image dans le modèle sans preprocessing manuel
2. Parser la sortie en JSON (noter les échecs de parsing)
3. Comparer champ par champ avec la GT
4. Calculer toutes les métriques listées ci-dessus
5. Logger les erreurs par type (détection, transcription, structuration)

### 8.4 Outils recommandés

| Outil | Usage |
|---|---|
| `jiwer` (Python) | Calcul WER/CER |
| `pycocotools` | Calcul mAP pour YOLOv10 |
| `rapidfuzz` | Fuzzy matching pour Partial Match Score |
| `json-schema` | Validation de la structure JSON |
| `time` / `torch.cuda.memory_allocated()` | Latence et VRAM |

---

## 9. Seuils de décision (Étape 3)

Un modèle est considéré **validé sans fine-tuning** s'il atteint simultanément :

| Critère | Seuil minimal |
|---|---|
| Exact Match (champs critiques : nom, HP, numéro) | ≥ 0.80 |
| Field Coverage (% champs extraits non-nuls) | ≥ 0.90 |
| JSON Validity Rate | ≥ 0.95 |
| Hallucination Rate | ≤ 0.05 |
| Latence médiane | ≤ 3 000 ms/image |
| CER global (si applicable) | ≤ 0.08 |

Si un modèle passe ces seuils → **validation, passage à l'Étape 4**.  
Si aucun modèle ne les atteint → **fine-tuning du meilleur candidat** sur le dataset Pokémon annoté.

### 9.1 Seuils pour le scan de plusieurs cartes (batch)

Ces seuils s'appliquent lors du traitement d'un lot de cartes en une seule session (scan d'une collection).

| Critère | Seuil minimal | Justification |
|---|---|---|
| **Throughput** | ≥ 2 cartes/sec | Objectif : scanner 100 cartes en < 1 min |
| **Latence P95** (95e percentile) | ≤ 5 000 ms/image | Évite les blocages sur les cartes difficiles |
| **Consistency (écart-type EM sur le batch)** | ≤ 0.10 | Les performances ne doivent pas s'effondrer sur certaines cartes |
| **VRAM peak sur un batch de 32 images** | ≤ VRAM allouée + 20 % | Pas de spike mémoire en batch |
| **Taux d'échec de parsing (batch)** | ≤ 0.05 | ≤ 5 % de cartes retournent un JSON invalide sur un lot |
| **Dégradation des métriques vs. carte seule** | ≤ 5 % de delta EM | Le batch ne doit pas dégrader la qualité vs. inférence unitaire |

> **Protocole** : mesurer sur un lot de 50 cartes consécutives sans réinitialisation du modèle entre les images.

Un modèle est considéré **validé pour le scan batch** s'il remplit les seuils de la section 9 **et** ceux ci-dessus simultanément.

---