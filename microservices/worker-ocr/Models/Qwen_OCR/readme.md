# Qwen2.5-VL — Rapport d'évaluation

Sous-tâche **COLLR-534** · cadre d'évaluation défini dans
[`../readme.md`](../readme.md) et [`../../../../docs/AI/model_evaluation/evaluation.md`](../../../../docs/AI/model_evaluation/evaluation.md).

**Conclusion en une ligne : fine-tuning nécessaire — OUI**, mais plusieurs échecs
sont imputables au prompt et à la quantization plutôt qu'au modèle. Voir
[Recommandations](#recommandations-avant-de-lancer-un-fine-tuning).

---

## Modèle testé

| | |
|---|---|
| **Modèle** | `Qwen/Qwen2.5-VL-7B-Instruct` |
| **Quantization** | int4 `nf4` via bitsandbytes (double quant, compute fp16) |
| **Pourquoi nf4 et pas AWQ** | même empreinte (~6 Go) sans dépendance à triton ni aux Visual Studio Build Tools sous Windows |
| **Résolution d'entrée** | 256×28² à 1280×28² pixels |
| **GPU** | NVIDIA GeForce RTX 4060 Laptop — 8,6 Go |
| **Jeu de test** | 15 cartes annotées à la main |

---

## Périmètre de l'évaluation

Ce rapport évalue **3 champs** : `name`, `set_code`, `set_number` — soit
l'**identification** d'une carte, pas l'extraction complète de son contenu.

`evaluation.md` §1 demande également HP, types, attaques (nom / coût / dégâts)
et rareté. Le prompt utilisé ne les extrait pas. Toute conclusion tirée d'ici
ne vaut donc que pour l'identification.

| Champ | Évalué |
|---|---|
| `name` | ✅ |
| `set_code` | ✅ |
| `set_number` | ✅ |
| HP, types, attaques, rareté | ❌ hors périmètre |

---

## Étapes effectuées

1. Reprise du prototype de scan (Master 1) : chargement du modèle, prompt avec
   règles anti-hallucination, parsing JSON tolérant, retry sur sortie dégénérée.
2. Tri du jeu d'images disponible : **38 candidates → 15 retenues**. Écartées
   les cartes en japonais (non annotables par l'auteur) et les photos contenant
   plusieurs cartes en grille, hors périmètre du scan unitaire. Les 9 cartes de
   la photo en grille sont conservées sous forme de crops individuels.
3. Constitution d'un corrigé annoté à la main — [`ground_truth.json`](ground_truth.json),
   **15 cartes** (6 photos individuelles + 9 crops).
4. Passage de chaque carte dans le modèle, avec chronométrage et relevé du pic VRAM.
5. Comparaison champ par champ au corrigé, calcul des métriques d'`evaluation.md` §2.
6. Confrontation aux seuils de décision d'`evaluation.md` §9.

### Jeu de test — localisation

**Les 15 images ne sont pas versionnées dans ce dépôt** : elles pèsent 64,6 Mo,
dont une de 11,3 Mo. Alourdir le dépôt de documentation de 64 Mo pour chaque
clone n'a pas été jugé raisonnable.

Elles se trouvent sur le poste de l'auteur, héritées du prototype de Master 1 :

```
C:\Users\theor\Documents\Epitech Master 1er année\ESP CollectioneuR
  \Scan Qwen2.5-VL-7B-AWQ\pokemon-card-scanner-qwen-7b\backend\uploads
```

Les noms de fichier attendus sont listés dans [`ground_truth.json`](ground_truth.json),
qui sert à la fois de corrigé et d'inventaire du jeu de test.

> **Conséquence à assumer : le notebook n'est pas rejouable en l'état par un
> autre membre de l'équipe.** Il faut soit récupérer les images auprès de
> l'auteur, soit reconstituer un jeu équivalent. Un emplacement de stockage
> partagé reste à définir pour l'équipe — le OneDrive, déjà utilisé pour la
> documentation de processus, serait cohérent.

**Reproduire :** récupérer les images, ouvrir [`Qwen.ipynb`](Qwen.ipynb), adapter
`IMAGES_DIR` en cellule 1, puis exécuter les cellules dans l'ordre. Le détail
par carte est exporté dans `resultats_qwen.csv`, versionné lui.

### Correction apportée au corrigé après coup

Une erreur d'annotation a été détectée et corrigée : `8f17caf4_cell_09` était
annotée `Evoli`, la carte porte `Évoli`. **Vérification faite en ouvrant l'image**,
pas en se fiant à la sortie du modèle — cette distinction est la garantie qu'on
ne réajuste pas le barème jusqu'à ce que le modèle ait raison.

Impact : `name` 13/15 → 14/15, identification 60 % → 66,7 %.
**Le verdict est inchangé** : le seuil de 80 % exige 12 cartes correctes sur 15,
on en compte 10.

### Corrections issues de la revue de code

La revue automatique de la PR a relevé cinq défauts du banc de mesure, tous
fondés. Les prédictions du modèle n'ont pas changé — seuls le calcul et
l'étiquetage des métriques étaient en cause.

| Défaut | Correction | Effet sur les résultats |
|---|---|---|
| CER calculé sur les chaînes brutes, alors que l'Exact Match ignore les espaces internes du `set_code` | même politique de normalisation appliquée aux deux | **CER 0,093 → 0,057 : le seuil passe d'échec à succès** |
| Exact Match présenté comme le critère §9, qui inclut le HP | critère renommé et signalé comme approximation | le critère §9 est désormais déclaré non mesuré |
| Latence chronométrée après le décodage d'image, comparée à un seuil de bout en bout | chronomètre déplacé, décomposition décodage / inférence enregistrée | aucun — la vraie valeur ne peut qu'être plus haute |
| Image manquante ignorée en silence, dénominateurs recalculés sur le sous-ensemble | le benchmark échoue désormais | aucun ici, mais supprime un risque de score faussé |
| Chemins relatifs au répertoire de travail de Jupyter | validation explicite au démarrage | aucun |

L'incohérence sur le CER était la plus sérieuse : elle produisait un échec de
seuil dû à une convention d'écriture que le benchmark déclare lui-même ignorer.

---

## Résultats

### Précision de l'OCR

| Métrique | Valeur | Détail |
|---|---|---|
| Exact Match — `name` | 93,3 % | 14/15 |
| Exact Match — `set_code` | 100 % | 12/12 |
| Exact Match — `set_number` | 73,3 % | 11/15 |
| **Exact Match — identification** (`name` + `set_number`) | **66,7 %** | 10/15 |
| Field Coverage | 100 % | aucun champ attendu laissé vide |
| Hallucination Rate | 100 % | 3/3 — voir ci-dessous |
| JSON Validity Rate | 100 % | 15/15 |
| CER global | 0,057 | après normalisation du `set_code` — 0,093 sans |

> Comparaison insensible à la casse et aux espaces de bord, sensible aux accents
> et aux typos. Les espaces internes du `set_code` sont ignorés : la carte
> imprime `TWM FR`, le prompt impose `TWMFR` — comparer strictement mesurerait
> une convention d'écriture, pas une erreur de lecture. **La même politique
> s'applique au CER**, sur les 12 cartes concernées.
>
> **Variante** : en ignorant aussi les espaces internes du `name`,
> `NoctaliVMAX` serait accepté pour `Noctali VMAX` et l'identification passerait
> à **73,3 %** (11/15). Le chiffre retenu ci-dessus est le plus strict des deux.

> **L'Exact Match identification n'est pas le critère d'`evaluation.md` §9.**
> §9 le définit sur **nom + HP + numéro**. Le HP n'est ni demandé au modèle ni
> présent dans le corrigé : la valeur de 66,7 % porte sur 2 des 3 champs. Le
> critère §9 tel qu'écrit **n'a pas été mesuré** ; ce qui suit en est une
> approximation, à ne pas présenter comme le critère officiel.

### Temps de scan par carte

| | Valeur |
|---|---|
| Médiane | 4 397 ms |
| Moyenne | 4 539 ms |
| P95 | 6 297 ms |

> Chronomètre incluant le retry éventuel — c'est le coût réel d'une carte.
>
> **Ces valeurs sont de la latence d'inférence seule.** Lors de cette campagne,
> le chronomètre démarrait après le décodage de l'image, alors qu'`evaluation.md`
> §2.3 définit la latence comme le temps **de bout en bout** par carte. Le
> notebook a depuis été corrigé et mesure désormais les deux, décodage inclus.
> La valeur de bout en bout ne peut être que **supérieure** à celle publiée
> ici : l'échec sur le seuil de 3 000 ms n'en est que plus certain.

### Consommation VRAM

| | Valeur |
|---|---|
| Poids du modèle au repos | 5,91 Go |
| **Pic pendant l'inférence** | **7,08 Go** |
| Marge restante sur le GPU | 1,5 Go (82 % d'occupation) |

### Robustesse

| | Valeur |
|---|---|
| Cartes ayant déclenché un retry | 0 % |
| Sorties JSON invalides | 0 |

---

## Avantages / limites

### Avantages

**Stabilité totale sur l'échantillon.** Zéro retry, zéro JSON invalide sur les
15 cartes. La pathologie de sortie dégénérée (boucles `!!!!!`, JSON cassé) qui
affectait le 3B dans le prototype a disparu. Le mécanisme de retry prévu n'a
jamais eu à se déclencher.

**Lecture du français irréprochable.** 14 noms sur 15, accents compris. Le
modèle a transcrit `Évoli` avec son accent, là où l'annotation humaine l'avait
oublié — la seule divergence sur ce champ venait du corrigé, pas du modèle.

**`set_code` parfait** : 12/12, y compris le suffixe de langue.

**Tient sur un GPU grand public.** 7,08 Go de pic sur une 4060 Laptop de 8,6 Go.
Pas besoin de matériel serveur pour l'inférence unitaire.

### Limites

**Le `set_number` est le point faible** — 11/15, et c'est ce champ qui fait
échouer le seuil. Les 4 erreurs se répartissent en trois causes distinctes :

| Carte | Attendu → obtenu | Cause |
|---|---|---|
| `0aa7a160` | `TG03/TG30` → `050/130` | format Trainer Gallery non reconnu |
| `4ab29752` | `TG03/TG30` → `TG30` | format Trainer Gallery, extraction partielle |
| `4af6727c` | `100/167` → `0059` | a pris le numéro Pokédex |
| `8f17caf4_cell_01` | `004/167` → `004/157` | erreur de lecture d'un chiffre |

Les deux premières forment un motif : le prompt ne donne que des exemples en
chiffres (`067/167`, `128/167`). Le modèle force ce format et ne reconnaît pas
le préfixe `TG`. Une seule erreur sur quatre est une vraie faute de lecture.

**Le modèle invente quand il ne sait pas — systématiquement.** Sur les 3 cartes
dont le `set_code` n'est pas lisible ou pas imprimé, il en a produit un à chaque
fois : `TWMFR`, `TG03`, `B15FR`. Sur `cdc2405a`, carte de l'ère Épée & Bouclier,
il n'y a **aucun code texte imprimé** — seulement un symbole graphique — et le
modèle a répondu `B15FR`.

Or la règle 3 du prompt est explicite : *« Si un champ est illisible, mets null.
Un null est TOUJOURS préférable à une réponse inventée. »* Elle est ignorée
3 fois sur 3. **Conséquence pour le pipeline : un champ non nul ne peut pas être
considéré comme fiable.** Une validation en aval est indispensable — contrôle de
format, recoupement TCGdex — car le prompt seul ne suffit pas à l'obtenir.

**Latence 47 % au-dessus du seuil** — 4 397 ms contre 3 000 ms exigés. À
relativiser : la quantization `nf4` de bitsandbytes déquantifie à la volée à
chaque passe, ce qui est reconnu plus lent qu'AWQ ou GPTQ. Ce choix a été fait
pour la compatibilité Windows, pas pour la performance. L'échec sur ce seuil est
donc imputable à la configuration autant qu'au modèle.

**Peu de marge mémoire** : 7,08 Go de pic sur 8,6 Go disponibles, soit 82 %
d'occupation. Le traitement par lots — exigé par `evaluation.md` §9.1 avec un
throughput de 2 cartes/seconde — n'est pas envisageable sur ce GPU dans cette
configuration.

---

## Confrontation aux seuils de décision

Seuils d'`evaluation.md` §9. Un modèle est validé **sans fine-tuning** s'il les
franchit tous simultanément.

| Critère | Seuil | Mesuré | Verdict |
|---|---|---|---|
| Exact Match nom + numéro <sup>(\*)</sup> | ≥ 0,80 | 0,667 | ⚠️ ❌ |
| Field Coverage | ≥ 0,90 | 1,000 | ✅ |
| JSON Validity Rate | ≥ 0,95 | 1,000 | ✅ |
| Hallucination Rate | ≤ 0,05 | 1,000 | ❌ |
| Latence médiane <sup>(†)</sup> | ≤ 3 000 ms | 4 397 ms | ❌ |
| CER global | ≤ 0,08 | 0,057 | ✅ |

<sup>(\*)</sup> **Approximation, pas le critère §9.** §9 le définit sur nom + HP +
numéro ; le HP est hors périmètre. Le critère officiel n'est donc pas mesuré.

<sup>(†)</sup> Latence d'inférence seule, hors décodage d'image. Le bout en bout
exigé par §2.3 serait supérieur — l'échec est donc acquis.

---

## Conclusion

**Fine-tuning nécessaire : OUI.** Trois seuils sur six ne sont pas franchis, et
un quatrième — l'Exact Match de §9 — n'a pas pu être mesuré tel qu'il est défini.

Le modèle est **fiable dans sa forme** — il répond toujours, toujours en JSON
valide, sans jamais dégénérer — mais **pas encore fiable dans son fond** : il se
trompe sur un numéro de set sur quatre, et invente systématiquement une réponse
là où il devrait s'abstenir.

**Le motif décisif est l'hallucination.** À lui seul il disqualifie le modèle
pour un usage sans garde-fou : 3 cartes sur 3 dont le `set_code` est absent ou
illisible ont reçu un code inventé, alors que le prompt l'interdit explicitement.
Aucun des autres échecs n'a ce caractère bloquant.

Cette conclusion mérite deux nuances. Sur les trois seuils en échec, deux ont une
cause identifiée qui n'est pas le modèle lui-même :

- la **latence** tient largement à la quantization `nf4`, choisie pour des
  raisons de compatibilité Windows ;
- la moitié des erreurs de `set_number` vient d'un **prompt qui ne décrit pas**
  le format Trainer Gallery.

Un fine-tuning est une opération coûteuse. Il serait prématuré de l'engager sans
avoir d'abord testé les correctifs à faible coût listés ci-dessous, qui
pourraient à eux seuls rapprocher le modèle des seuils.

### Recommandations avant de lancer un fine-tuning

| Priorité | Action | Seuil visé | Coût |
|---|---|---|---|
| 1 | Ajouter les formats `TG` aux exemples du prompt | Exact Match | quelques minutes |
| 2 | Ajouter une validation en aval : contrôle du format `XXX/YYY` et recoupement TCGdex avant d'accepter un champ | Hallucination — **le seul échec bloquant** | un jour |
| 3 | Rejouer le benchmark en quantization AWQ ou GPTQ | Latence | une demi-journée |
| 4 | Étendre le jeu de test à 50 cartes annotées comme l'exige §8.1 | fiabilité de la mesure | plusieurs jours |
| 5 | Ajouter le HP au prompt et au corrigé, pour mesurer le critère §9 tel qu'il est défini | Exact Match (critère officiel) | une demi-journée |

L'action 2 mérite une précision : elle ne fera pas baisser le taux
d'hallucination du modèle, qui restera le même. Elle empêche l'hallucination
d'atteindre la base de données — ce qui est l'objectif réel. C'est pour ça
qu'elle passe devant les autres : c'est le seul échec qui bloque une mise en
production, les autres dégradent la qualité sans la compromettre.

---

## Réserves méthodologiques

À conserver dans le rapport final, elles conditionnent la portée des résultats.

1. **15 cartes au lieu des 50** demandées par `evaluation.md` §8.1, soit moins
   d'un tiers. Chaque carte pèse ~6,7 points d'Exact Match : une seule erreur
   fait bouger le résultat de 6,7 points, et l'écart au seuil de 0,80 se joue
   à deux cartes près. Les chiffres obtenus sont indicatifs, pas conclusifs.
2. **Le taux d'hallucination repose sur 3 cas.** Le constat est net — 3 sur 3,
   sans exception — mais l'échantillon interdit d'en faire un pourcentage
   fiable. À lire comme un signal qualitatif fort, pas comme une mesure.
3. **Diversité réelle plus faible que les 15 cartes ne le suggèrent** : 9 des
   15 proviennent d'une **même photo** en grille, donc d'un unique jeu de
   conditions (appareil, éclairage, angle, résolution). Le jeu couvre en
   pratique 7 prises de vue, pas 15.
4. **Internationalisation non testée.** Les cartes japonaises présentes dans le
   jeu initial ont été écartées faute de pouvoir les annoter. `evaluation.md`
   §2.4 en fait pourtant un scénario de robustesse, et §7 présente la gestion
   du japonais et du coréen comme un point fort supposé de Qwen2.5-VL. Ce point
   fort n'est ni vérifié ni infirmé ici.
5. **Dataset non représentatif par construction** : les photos proviennent de
   tests ad hoc, sans répartition contrôlée entre layouts simples, cartes
   EX/V/VMAX, et cartes abîmées ou avec reflets (§8.1 en exige au moins 10).
6. **Ground truth annotée par une seule personne**, sans relecture croisée. Une
   erreur a d'ailleurs été détectée après coup (voir plus haut) ; rien ne
   garantit qu'il n'en reste pas.
7. **3 champs sur 7** — voir le périmètre ci-dessus. Conséquence directe : le
   critère Exact Match d'`evaluation.md` §9, défini sur nom + HP + numéro,
   **n'a pas été mesuré tel qu'il est écrit**. Le chiffre de 66,7 % en est une
   approximation sur 2 des 3 champs, et ne doit pas être cité comme le
   résultat du critère officiel.
8. **Une seule taille de modèle testée** (7B). `evaluation.md` §5 recommande de
   benchmarker aussi le 3B pour situer le ratio performance/coût.
9. **Scan unitaire uniquement.** Les seuils de traitement par lots (§9.1) n'ont
   pas été évalués.
10. **Résultats non reproductibles en l'état par un tiers** : le jeu de test
    n'est pas versionné, voir [Jeu de test — localisation](#jeu-de-test--localisation).
