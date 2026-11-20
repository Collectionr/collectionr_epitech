# Modèles pour prédire le prix des cartes Pokémon

Sortie voulue : courbe de tendance (30 à 90 jours) + bande de confiance + date du dernier entraînement.

| # | Modèle | Colonnes utilisées | Quand l'utiliser |
|---|---|---|---|
| 1 | **ETS** (lissage exponentiel) | `date`, `median7d` | Le plus simple, sert de point de comparaison |
| 2 | **LightGBM en quantiles** (p10 / p50 / p90) | prix, `low`, `high`, `saleCount`, grade, rareté, set | Cartes avec beaucoup de données et de ventes |
| 3 | **Chronos** (modèle pré-entraîné) | `date`, `median7d` | Cartes récentes avec peu d'historique |
| 4 | **LSTM** (réseau de neurones) | prix, `low`, `high`, `saleCount`, grade | Beaucoup de cartes et d'historique, à comparer à LightGBM |

La bande de confiance vient des quantiles p10 et p90.

## Caractéristiques, avantages, inconvénients

| Modèle | Caractéristiques | Avantages | Inconvénients |
|---|---|---|---|
| **ETS** | Méthode statistique classique. Une série de prix à la fois. Presque pas d'entraînement. | Très rapide<br>Simple à expliquer<br>Marche avec peu de données<br>Pas besoin de GPU | Ne voit que le prix (pas le grade ni les ventes)<br>Réagit mal aux changements brusques (sortie d'extension, hype)<br>Bande moins précise à 90 jours |
| **LightGBM** | Arbres de décision. Apprend sur beaucoup de cartes en même temps et utilise beaucoup de colonnes. | Rapide et précis<br>Utilise toutes les colonnes<br>Supporte les valeurs manquantes<br>Donne p10 / p50 / p90 directement | Il faut préparer les colonnes à la main<br>Un modèle par horizon (30, 60, 90 jours)<br>Faible sur les cartes sans historique |
| **Chronos** | Modèle déjà entraîné sur plein de séries. On l'utilise tel quel. | Aucun entraînement<br>Marche sur les cartes récentes<br>Donne des quantiles directement | Utilise surtout le prix seul<br>Pas entraîné sur les cartes Pokémon<br>Moins de contrôle<br>Plus lourd à exécuter (GPU conseillé) |
| **LSTM** | Réseau de neurones qui lit la série jour après jour et garde une « mémoire » du passé. | Capte des tendances complexes<br>Peut utiliser plusieurs colonnes<br>Un seul modèle pour beaucoup de cartes | Besoin de beaucoup de données<br>Entraînement long (GPU)<br>Beaucoup de réglages<br>Boîte noire, difficile à expliquer<br>Bande de confiance à construire (pas native)<br>Pas toujours meilleur que LightGBM |

---

## Colonnes disponibles pour l'entraînement (Poketrace)

### Historique des prix (la base de tout)

1 ligne = 1 jour, pour 1 carte, 1 tier et 1 source. Périodes possibles : 7d, 30d, 90d, 1y, all.

| Colonne | Ce que c'est |
|---|---|
| `date` | Le jour |
| `source` | D'où vient le prix (`ebay`, `tcgplayer`, `cardmarket`...) |
| `avg` | Prix moyen du jour |
| `low` / `high` | Prix le plus bas / le plus haut du jour |
| `saleCount` | Nombre de ventes |
| `median3d` / `median7d` / `median30d` | Prix médian sur 3, 7 et 30 jours |
| `avg1d` / `avg7d` / `avg30d` | Moyennes de tendance (Europe, CardMarket) |

### 1. Prix des cartes gradées

Même colonnes que l'historique, mais pour un grade précis.

| Colonne | Ce que c'est |
|---|---|
| tier | Société + note : `PSA_10`, `BGS_9_5`, `CGC_10`... |
| Sociétés | PSA, BGS, CGC, SGC, ACE, TAG |
| `gradedOptions` | Grades disponibles pour la carte |
| `hasGraded` | La carte a-t-elle des prix gradés (oui/non) |

### 2. Listings (ventes une par une)

| Colonne | Ce que c'est |
|---|---|
| `price` | Prix de vente |
| `soldAt` | Date et heure de la vente |
| `grader` / `grade` | Société et note (si carte gradée) |
| `condition` | État de la carte (si non gradée) |
| `anomalyFlag` | Vente suspecte (prix aberrant) |

Source : ventes eBay uniquement.

### 3. Markets & tiers

| Colonne | Ce que c'est |
|---|---|
| `market` | `US` (en USD) ou `EU` (en EUR), jamais les deux pour une même carte |
| tier brut | `NEAR_MINT`, `LIGHTLY_PLAYED`, `DAMAGED`... (carte non gradée) |
| `rarity`, `set`, `variant` | Rareté, extension, version (Holofoil...) |
| `country` | Pays du vendeur (Europe : DE, FR, IT, ES...) |

Plans requis : historique et gradées = Pro ou plus ; listings = Scale.

---

## Mots-clés expliqués

| Mot | Explication simple |
|---|---|
| **ETS** | Méthode statistique qui lisse le passé du prix pour en prolonger la tendance. Rapide et facile à comprendre. |
| **LightGBM** | Modèle d'apprentissage basé sur des arbres de décision. Il peut utiliser beaucoup de colonnes à la fois (prix, ventes, grade...). |
| **Chronos** | Modèle déjà entraîné par d'autres sur plein de séries de prix. On l'utilise directement, sans l'entraîner nous-mêmes. |
| **LSTM** | Réseau de neurones qui lit les prix jour après jour et garde en mémoire ce qui s'est passé avant. Bon pour repérer des tendances complexes, mais gourmand en données. |
| **GPU** | Carte graphique de calcul, utile pour entraîner les gros modèles (LSTM) plus vite. |
| **Boîte noire** | Modèle dont on ne peut pas facilement expliquer pourquoi il prédit tel prix. |
| **Quantiles (p10 / p50 / p90)** | Trois prévisions à la fois : p50 = scénario du milieu (la courbe), p10 = scénario bas, p90 = scénario haut. |
| **Bande de confiance** | La zone entre p10 et p90. Le vrai prix doit y tomber environ 8 fois sur 10. |
| **Courbe de tendance** | La ligne p50, du jour 1 au jour 30 à 90. |
| **Dernier entraînement** | La date où le modèle a été mis à jour pour la dernière fois, affichée à côté du graphe. |
| **`date`** | Le jour du prix. |
| **`median7d`** | Prix médian des 7 derniers jours. Plus stable qu'une moyenne, car peu sensible aux ventes bizarres. |
| **`low` / `high`** | Prix le plus bas et le plus haut du jour. |
| **`saleCount`** | Nombre de ventes du jour. Plus il est élevé, plus le prix est fiable. |
| **Grade** | Note de la carte donnée par une société (ex. PSA 10 = parfaite). Une carte gradée coûte plus cher. |
| **Rareté / set** | Niveau de rareté de la carte et extension dont elle vient. |
| **Peu d'historique** | Carte récente : on a peu de jours de prix, donc moins de matière pour prédire. |
