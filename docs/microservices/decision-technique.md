# Décision technique — Stratégie de collecte des prix

## Contexte

Le microservice scraper a pour objectif de collecter les prix des cartes Pokémon TCG depuis plusieurs marketplaces.

Ces plateformes proposent, pour la plupart, des **APIs officielles** permettant d’accéder à des données structurées (prix, volume, tendances).

Cependant, certaines informations peuvent être :
- absentes des APIs
- incomplètes
- ou disponibles uniquement via les pages web

---

## Décision

### Approche retenue : **API-first avec fallback scraping**

La stratégie adoptée est la suivante :

1. **Utilisation prioritaire des APIs officielles**
2. **Utilisation du scraping HTML uniquement en complément**
3. **Usage d’un navigateur headless uniquement si nécessaire**

---

## Justification

### Fiabilité

Les APIs fournissent :
- des données structurées
- une meilleure stabilité dans le temps
- une résistance aux changements d’interface

À l’inverse, le scraping HTML est :
- fragile (dépend du DOM)
- sensible aux changements front
- plus coûteux en maintenance

---

### Performance

- Les APIs sont plus rapides et optimisées pour la récupération de données
- Le scraping, notamment avec rendu JavaScript, est plus lent et plus consommateur de ressources

---

### Maintenabilité

- API → faible coût de maintenance
- Scraping → coût élevé (mise à jour régulière nécessaire)

---

### Légalité et conformité

- APIs → usage encadré et autorisé
- Scraping → dépend des conditions d’utilisation des sites

---

## Choix des outils

### Cas principal : APIs officielles

Utilisées pour :
- Cardmarket
- eBay
- TCGPlayer

---

### Scraping HTML (fallback)

#### Cas d’usage :
- données absentes de l’API
- vérification ou enrichissement

#### Outils retenus :

**Requests + BeautifulSoup**
- rapide
- simple
- adapté aux pages statiques

---

### Scraping dynamique (cas exceptionnel)

#### Cas d’usage :
- contenu chargé en JavaScript
- pages nécessitant un rendu navigateur

#### Outil retenu :

**Playwright**
- support JavaScript complet
- plus moderne et stable que Selenium

---

## Outils non retenus

### Scrapy
- trop complexe pour le besoin
- adapté aux projets de scraping massif
- non pertinent dans une approche API-first

### Selenium
- plus lourd que Playwright
- moins performant et moins moderne

---

## Conclusion

La stratégie retenue permet de :

- maximiser la fiabilité (API-first)
- limiter la dette technique
- conserver de la flexibilité via le scraping en fallback

> Le scraping est considéré comme un mécanisme secondaire et non comme une source principale de données.