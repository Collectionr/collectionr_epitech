Produis un débrief technique complet de ce qui a été fait dans cette session, écrit pour que l'utilisateur puisse **défendre ce code comme s'il l'avait développé lui-même** — en revue de code, devant le Tech Lead, ou face à un jury Epitech.

## Règles de rédaction

- **Zéro complaisance** : ton propre travail se critique comme celui d'un tiers. Les faiblesses, raccourcis et dettes sont signalés spontanément, pas cachés.
- **Toujours le pourquoi** : chaque choix technique est justifié (et l'alternative écartée est nommée avec la raison du rejet). « On a fait X » sans « parce que Y, plutôt que Z » est inutile.
- **Distinguer trois niveaux de certitude** : ✅ vérifié (test/exécution à l'appui) · 🔧 fait mais non vérifié en conditions réelles · ⚠️ supposé/à confirmer.
- Précision d'ingénieur : chemins de fichiers cliquables, noms de classes, extraits de code courts pour les points structurants. Pas de vulgarisation excessive — l'utilisateur est développeur.
- Si la session a été compactée ou que le contexte est partiel : reconstituer via `git log` / `git diff` des commits de la session et le dire explicitement.

## Structure du débrief

### 1. Contexte et périmètre
Ticket(s) traité(s), objectif, ce qui était explicitement hors périmètre (et pourquoi).

### 2. Ce qui a été construit
Par bloc logique (pas par fichier) : le composant, son rôle, où il vit, comment il s'intègre à l'existant. Mentionner les dépendances ajoutées et leur justification.

### 3. Décisions techniques — le cœur du débrief
Pour chaque décision structurante, le format :
- **Décision** : ce qui a été choisi
- **Pourquoi** : la raison concrète (contrainte projet, SLA, convention d'équipe, dette évitée)
- **Alternative écartée** : ce qu'on aurait pu faire et pourquoi on ne l'a pas fait
- **Conséquence** : ce que ça engage pour la suite (couplage, migration future, effet sur les prochains tickets)

### 4. Ce qui a été vérifié — et comment
Tests écrits (quoi exactement, avec quelles doublures), vérifications manuelles effectuées (commandes + résultats), et surtout **ce qui n'est PAS couvert** et dans quelles conditions ça pourrait casser.

### 5. Dettes, raccourcis et points de vigilance
Tout ce qu'un reviewer expert relèverait : compromis assumés, TODO implicites, code transitoire, seuils arbitraires, comportements limites non gérés. Pour chacun : gravité et quand il faudra le traiter.

### 6. Questions pièges — pour tester ta maîtrise
5 à 8 questions qu'un Tech Lead ou un jury poserait sur ce code, **avec leurs réponses**, des plus évidentes aux plus pointues. Exemples de calibre : « pourquoi ce endpoint échappe au préfixe API ? », « que se passe-t-il si Redis tombe pendant une requête ? », « pourquoi ce timeout à cette valeur ? ».

### 7. Impact sur la suite
Ce que cette session change pour les prochains tickets : ce qui est maintenant disponible gratuitement, ce qui devra être adapté, les pièges qui attendent le prochain développeur.

## Arguments optionnels

`$ARGUMENTS` peut préciser un focus : `/debrief sécurité` (angle sécu uniquement), `/debrief COLLR-434` (un ticket précis), `/debrief court` (sections 3, 5 et 6 seulement). Sans argument : débrief complet.
