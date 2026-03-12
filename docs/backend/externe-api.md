# Intégration de l'API TCGDex

## Vue d'ensemble

Le projet s'appuie actuellement sur l'**API TCGDex** comme fournisseur externe de métadonnées pour les cartes du JCC Pokémon.

TCGDex est une **API REST open-source** qui fournit des données structurées pour les cartes du Jeu de Cartes à Collectionner Pokémon, incluant les détails des cartes, les sets, les séries et les images.

Elle est utilisée pendant le développement comme **base de données de cartes temporaire** avant de migrer les données vers la **base de données interne CollectionR**.

---

## Fonctionnalités principales

L'API fournit :

- Métadonnées des cartes Pokémon
- Sets et séries de cartes
- Informations sur les attaques et capacités
- Images des cartes
- Support multilingue
- Endpoints REST

Taille du jeu de données :

- ~22 000 cartes Pokémon
- Plusieurs langues (EN, FR, JP, etc.)

---

## Exemple d'endpoint

Récupérer une carte spécifique par son ID.

```
GET https://api.tcgdex.net/v2/en/cards/swsh3-136
```

Exemple de réponse :

```json
{
  "id": "swsh3-136",
  "name": "Charizard",
  "hp": 170,
  "types": ["Fire"],
  "attacks": [
    {
      "name": "Fire Spin",
      "damage": "220"
    }
  ],
  "image": "https://assets.tcgdex.net/en/swsh/swsh3/136/high.webp"
}
```

---

## Utilisation dans le backend

Le backend peut récupérer les données de cartes depuis TCGDex via une simple requête HTTP.

Exemple d'implémentation en TypeScript :

```ts
async function getCard(id: string) {
  const response = await fetch(
    `https://api.tcgdex.net/v2/en/cards/${id}`
  );

  return response.json();
}
```

Cas d'utilisation typiques :

* Récupérer les métadonnées d'une carte
* Récupérer les images
* Alimenter la base de données interne
* Assister le pipeline de scan

---

## Stratégie d'intégration

En début de développement, le backend peut interroger TCGDex directement.

En production, l'architecture évoluera vers :

```
API TCGDex
    │
    ▼
Worker de synchronisation
    │
    ▼
Base de données CollectionR (PostgreSQL)
    │
    ▼
API Backend
```

Cela garantit :

* Des requêtes plus rapides
* L'indépendance vis-à-vis des APIs tierces
* Une meilleure fiabilité

---

## Documentation officielle

Pour la référence complète de l'API, consultez la documentation officielle :

Documentation de l'API TCGDex :
[https://tcgdex.dev](https://tcgdex.dev)

Endpoint de base de l'API :
[https://api.tcgdex.net](https://api.tcgdex.net)

---

## Notes

* Aucune clé API n'est requise.
* L'API est gratuite et open source.
* Les images sont hébergées sur le CDN TCGDex.
* L'API supporte plusieurs langues.

Exemple de paramètre de langue :

```
/v2/en/cards/{id}
/v2/fr/cards/{id}
```