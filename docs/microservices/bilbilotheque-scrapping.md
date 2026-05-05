# Étude des bibliothèques de scraping

## Objectif

Cette section a pour but d’identifier, comparer et sélectionner les bibliothèques de scraping les plus adaptées au microservice scraper.

Le projet privilégie les **APIs officielles** des marketplaces.  
Le scraping HTML est utilisé uniquement en complément lorsque nécessaire.

---

## Typologie des besoins

Le choix d’une bibliothèque dépend principalement de 3 critères :

### 1. Type de site

| Type de site | Caractéristiques             | Approche recommandée       |
|--------------|------------------------------|----------------------------|
| Statique     | HTML simple, pas de JS       | Client HTTP + parseur HTML |
| Dynamique    | Contenu chargé en JavaScript | Navigateur headless        |

---

### 2. Taille du projet

| Taille                  | Recommandation                                               |
|-------------------------|--------------------------------------------------------------|
| Petit projet            | Solutions simples (Requests + BeautifulSoup, MechanicalSoup) |
| Projet moyen            | Playwright / Selenium                                        |
| Projet à grande échelle | Scrapy                                                       |

---

### 3. Complexité technique

| Niveau        | Recommandation                           |
|---------------|------------------------------------------|
| Débutant      | MechanicalSoup, Requests + BeautifulSoup |
| Intermédiaire | Playwright, Selenium                     |
| Avancé        | Scrapy                                   |

---

## Bibliothèques principales (Python / usage projet)

### Requests + BeautifulSoup

- **Usage** : scraping simple (HTML statique)
- **Avantages** :
  - Très rapide
  - Facile à utiliser
  - Léger
- **Inconvénients** :
  - Pas de gestion JavaScript
- **Cas d’usage** :
  - APIs HTML simples
  - Pages statiques

---

### MechanicalSoup

- **Usage** : simulation de navigation simple
- **Avantages** :
  - Simple
  - Adapté aux débutants
- **Inconvénients** :
  - Limité
  - Pas adapté aux sites complexes

---

### Selenium

- **Usage** : automatisation navigateur
- **Avantages** :
  - Support JavaScript complet
  - Simule un utilisateur réel
- **Inconvénients** :
  - Lent
  - Consommation élevée

---

### Playwright

- **Usage** : alternative moderne à Selenium
- **Avantages** :
  - Plus stable
  - Multi-navigateurs
  - Bonne gestion async
- **Inconvénients** :
  - Plus complexe
- **Remarque** :
  - Possibilité d’ajouter des plugins anti-détection

---

### Scrapy

- **Usage** : scraping à grande échelle
- **Avantages** :
  - Très performant
  - Structuré (framework complet)
  - Gestion des pipelines
- **Inconvénients** :
  - Courbe d’apprentissage élevée
- **Cas d’usage** :
  - Projets long terme
  - Volume important de données

---

### Requests-HTML

- **Usage** : compromis entre simplicité et JS léger
- **Avantages** :
  - Simple
  - Support partiel du JS
- **Inconvénients** :
  - Moins robuste que Playwright

---

## Comparatif global

| Bibliothèque     | Type                    | HTTP | HTML | JS | Anti-détection | Complexité |
|-----------------|--------------------------|------|------|----|----------------|------------|
| Requests        | Client HTTP              | ✔️   | ❌   | ❌ | ❌             | Faible     |
| BeautifulSoup   | Parseur HTML             | ❌   | ✔️   | ❌ | ❌             | Faible     |
| MechanicalSoup  | Navigation simple        | ✔️   | ✔️   | ❌ | ❌             | Faible     |
| Selenium        | Navigateur               | ✔️   | ✔️   | ✔️ | ❌             | Moyenne    |
| Playwright      | Navigateur               | ✔️   | ✔️   | ✔️ | Partiel        | Élevée     |
| Scrapy          | Framework                | ✔️   | ✔️   | ❌ | ❌             | Élevée     |
| curl_cffi       | Client HTTP avancé       | ✔️   | ❌   | ❌ | ✔️             | Moyenne    |

---

## Autres bibliothèques (hors scope principal)

Certaines bibliothèques existent mais sont moins pertinentes pour ce projet :

| Bibliothèque   | Langage| Remarque                     |
|----------------|--------|------------------------------|
| Osmosis        | Java   | Puissant mais hors stack     |
| Nokogiri       | Ruby   | Très bon parseur HTML        |
| Goutte         | PHP    | Simple mais limité           |
| X-ray / Node   | JS     | Intéressant mais hors Python |

---

## Critères de choix

### Performance
- Requests + BS4 → rapide
- Scrapy → très performant à grande échelle
- Selenium/Playwright → plus lent

### Complexité
- Simple : Requests, MechanicalSoup
- Intermédiaire : Selenium
- Avancé : Scrapy, Playwright

### Support JavaScript
- Non : Requests, Scrapy (sans plugin)
- Oui : Selenium, Playwright

---

## Recommandation pour le projet

### Stratégie retenue

1. **Priorité : APIs officielles**
2. **Fallback scraping HTML**

### Stack recommandée :

- **Cas simple (HTML statique)** :
  - Requests + BeautifulSoup

- **Cas dynamique (JS)** :
  - Playwright

- **Cas avancé / volumétrie élevée (optionnel)** :
  - Scrapy

---

## Conclusion

Le choix des outils dépend du besoin :

- Simplicité → Requests + BeautifulSoup  
- Dynamique → Playwright  
- Scalabilité → Scrapy  

Dans le cadre du projet :

> Le scraping reste secondaire. Les APIs officielles couvrent la majorité des besoins.