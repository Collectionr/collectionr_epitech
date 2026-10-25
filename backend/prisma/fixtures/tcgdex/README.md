# Fixtures TCGdex de référence (COLLR-684)

Réponses de l'[API TCGdex](https://tcgdex.dev) pour les trois sets du catalogue de référence, en
anglais et en français. `prisma/seed.ts` les lit (via `prisma/catalogue/CatalogueFixtures.ts`) et
insère le catalogue en développement. Les données viennent de la base de cartes TCGdex, sous licence
MIT : voir [`LICENSE`](./LICENSE) (l'attribution est à conserver, la licence l'exige).

| Set | Id TCGdex | Cartes | Pourquoi celui-ci |
| --- | --- | --- | --- |
| Base Set / Set de Base | `base1` | 102 | 1999, aucune carte secrète, cartes Dresseur et Énergie, raretés traduites (`Common` / `Commune`) |
| Darkness Ablaze / Ténèbres Embrasées | `swsh3` | 201 | Exemple de la documentation TCGdex (`swsh3-20`), cartes secrètes (189 officielles, 201 au total) |
| 151 | `sv03.5` | 207 | Set récent, id avec un point, numéros de carte avec zéros initiaux (`006`) |

## Format des fichiers

`{set}.{en|fr}.json`, une seule ligne chacun :

```json
{ "retrievedAt": "…", "source": "https://api.tcgdex.net/v2/en", "set": { … }, "cards": [ { … } ] }
```

- `set` est la réponse de `GET /v2/{lang}/sets/{id}`, sans sa liste `cards` (les fiches résumées sont
  redondantes avec `cards`).
- `cards` contient la réponse de `GET /v2/{lang}/cards/{id}` pour chaque carte du set.
- **Les blocs `pricing` ont été retirés** (au niveau de la carte et dans `variants_detailed`) : les prix
  du marché ne sont pas couverts par la licence MIT de TCGdex (les CGU de Cardmarket / TCGPlayer
  s'appliquent) et sortent du périmètre des tables du catalogue. Le reste est conservé tel que renvoyé.
- Aucune image n'est téléchargée : `image`, `logo` et `symbol` sont des URL du CDN TCGdex, stockées telles quelles.

Récupérées le 2026-10-25.

## Rafraîchir les fixtures

Pour chaque set de `REFERENCE_SET_IDS` (`prisma/catalogue/CatalogueFixtures.ts`) et chaque langue :
récupérer le set, puis chaque carte de sa liste `cards`, retirer `pricing`, écrire le fichier. Les
tests de `prisma/catalogue/` vérifient la forme, le nombre de cartes annoncé par TCGdex et l'absence de
prix : un mauvais rafraîchissement fait échouer `npm test`.
