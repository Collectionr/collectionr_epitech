# 📘 Pokemon card scanner & CollectionR API

---

# 1. overview

cette api permet de :

* récupérer les informations d’une carte pokémon
* récupérer les prix du marché

elle combine :

* une base interne de cartes
* des données de prix venant de sources externes

---

# 2. collectionr card api

## objectif

la collectionr card api sert à gérer les données des cartes pokémon.

elle permet de :

* stocker les cartes
* récupérer leurs informations
* faire des recherches

les données internes sont la source principale.
les api externes servent uniquement à ajouter les prix.

---

# 3. modèles de données

## card

```json
{
  "id": "swsh3-136",
  "name": "Charizard",
  "set": "Darkness Ablaze",
  "number": "136",
  "rarity": "Rare Holo",
  "types": ["Fire"],
  "hp": 170,
  "image": "https://cdn.collectionr.com/cards/swsh3-136.png"
}
```

## marketprice

```json
{
  "card_id": "swsh3-136",
  "source": "ebay",
  "average_price": 45.5,
  "currency": "EUR"
}
```

---

# 4. endpoints

## get /cards/:id

récupère une carte

```
GET /cards/swsh3-136
```

réponse :

```json
{
  "id": "swsh3-136",
  "name": "Charizard",
  "set": "Darkness Ablaze",
  "rarity": "Rare Holo"
}
```

---

## get /cards/search

recherche une carte

```
GET /cards/search?q=pikachu
```

---

# 5. prix du marché

les prix sont récupérés depuis plusieurs sources :

* cardmarket
* ebay
* tcgplayer

les données sont combinées pour donner une estimation du prix moyen.

---

# 6. codes de réponse

| code | signification     |
| ---- | ----------------- |
| 200  | succès            |
| 400  | requête invalide  |
| 404  | carte introuvable |
| 500  | erreur serveur    |

---
