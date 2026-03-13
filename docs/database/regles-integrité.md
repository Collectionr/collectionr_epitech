# Règles d'Intégrité & Contraintes SQL — TCG App

> Ce document détaille les contraintes SQL, les règles de persistance et les scénarios d'intégrité des données.
> Il s'adresse aux développeurs backend et DBA.

---

## Table des matières

1. [Colonnes obligatoires vs nullables](#colonnes-obligatoires-vs-nullables)
2. [Contraintes UNIQUE](#contraintes-unique)
3. [Contraintes CHECK](#contraintes-check)
4. [Énumérations (ENUM)](#énumérations-enum)
5. [Soft Delete & Historisation](#soft-delete--historisation)
6. [Cascades & Suppressions](#cascades--suppressions)
7. [Intégrité Relationnelle : Le "Triangle" Card-Variant](#intégrité-relationnelle--le-triangle-card-variant)
8. [Gestion de la Temporalité](#gestion-de-la-temporalité)
9. [Unicité et Prévention des Doublons Métier](#unicité-et-prévention-des-doublons-métier)
10. [Énumérations Avancées](#énumérations-avancées)
11. [Sécurité et Permissions SQL (DCL)](#sécurité-et-permissions-sql-dcl)
12. [Optimisation des Triggers](#optimisation-des-triggers)
13. [Triggers SQL recommandés](#triggers-sql-recommandés)
14. [Scénarios d'intégrité](#scénarios-dintégrité)
15. [Points critiques à vérifier](#points-critiques-à-vérifier)

---

## Colonnes obligatoires vs nullables

| Table | Colonne | Nullable | Raison |
|-------|---------|----------|--------|
| **USER** | email | NOT NULL | Identifiant unique pour authentification |
| **USER** | passwordHash | NOT NULL | Obligatoire pour la connexion |
| **USER** | username | NOT NULL | Identifiant public unique |
| **USER** | roleId | NOT NULL | Chaque user doit avoir un rôle |
| **USER** | isActive | NOT NULL (default: true) | Soft delete flag |
| **COLLECTIONITEM** | variantId | **NULL** | Toutes les cartes n'ont pas de variante |
| **PRICEHISTORY** | variantId | **NULL** | Prix globale carte vs prix spécifique variante |
| **WISHLIST** | variantId | **NULL** | Souhait à niveau carte ou variante |
| **GRADINGRESULT** | variantId | **NULL** | Résultat au niveau carte ou variante |
| **VARIANT** | imageUrl | NOT NULL | Chaque variante doit avoir une image |
| **SESSION** | isRevoked | NOT NULL (default: false) | Flag de révocation |

---

## Contraintes UNIQUE

| Table | Colonnes | Raison |
|-------|----------|--------|
| **USER** | email | Pas de compte doublon |
| **USER** | username | Chaque username unique globalement |
| **DATASOURCE** | name | Une seule source par plateforme |
| **LICENCE_TCG** | slug | URL propre unique |
| **SET** | (licenceTCGId, name) | Pas d'extension doublon par licence |

---

## Contraintes CHECK

| Table | Colonne | Condition | Raison |
|-------|---------|-----------|--------|
| **CARD** | hp | hp >= 0 | PV ne peut pas être négatif |
| **CARD** | predictedPrice | predictedPrice >= 0 | Prix ne peut pas être négatif |
| **PRICEHISTORY** | price | price >= 0 | Prix ne peut pas être négatif |
| **GRADINGRESULT** | score | score BETWEEN 0 AND 10 | Score sur 10 |
| **GRADINGRESULT** | centeringScore | centeringScore BETWEEN 0 AND 10 | Score sur 10 |
| **GRADINGRESULT** | cornersScore | cornersScore BETWEEN 0 AND 10 | Score sur 10 |
| **GRADINGRESULT** | edgesScore | edgesScore BETWEEN 0 AND 10 | Score sur 10 |
| **GRADINGRESULT** | surfaceScore | surfaceScore BETWEEN 0 AND 10 | Score sur 10 |
| **COLLECTIONVALUEHISTORY** | totalValue | totalValue >= 0 | Valeur ne peut pas être négative |

---

## Énumérations (ENUM)

| Table | Colonne | Valeurs | Usage |
|-------|---------|---------|-------|
| **PRICEHISTORY** | condition | NM, LP, MP, HP, DMG | État physique de la carte |
| **COLLECTIONITEM** | condition | NM, LP, MP, HP, DMG | État physique de la carte |
| **SCANHISTORY** | status | PENDING, PROCESSING, COMPLETED, FAILED | Statut du scan asynchrone |
| **WISHLIST** | priority | HIGH, MEDIUM, LOW | Priorité du souhait |

---

## Soft Delete & Historisation

| Table | Stratégie | Implémentation |
|-------|-----------|-----------------|
| **USER** | Soft delete | `isActive` boolean flag → requêtes WHERE isActive = true |
| **DATASOURCE** | Soft delete | `isActive` boolean flag → désactiver source sans supprimer historique |
| **SESSION** | Soft delete | `isRevoked` boolean flag → révocation sans suppression |
| **PRICEHISTORY** | Immutable (INSERT only) | Jamais modifié, jamais supprimé → journalisation automatique |
| **GRADINGRESULT** | Immutable (INSERT only) | Jamais modifié, jamais supprimé → historique des analyses |
| **AUDITLOG** | Immutable (INSERT only) | Jamais modifié, jamais supprimé → journalisation complète |
| **COLLECTIONVALUEHISTORY** | Immutable (INSERT only) | Snapshot à un instant T → courbe d'évolution |
| **SCANHISTORY** | Immutable (INSERT only) | Trace complète des scans effectués |

---

## Cascades & Suppressions

| Relation | Cascade | Raison |
|----------|---------|--------|
| COLLECTION → COLLECTIONITEM | **SOFT DELETE** | Ne pas perdre l'historique des collections |
| COLLECTIONITEM → GRADINGRESULT | **Nullify** (gradingResultId = NULL) | Garder le grading même si item supprimé |
| USER → COLLECTION | **SOFT DELETE** (isActive=false) | Ne pas perdre les collections d'un user inactif |
| USER → SESSION | **DELETE** | Supprimer les sessions d'un user supprimé |
| CARD → COLLECTIONITEM | **RESTRICT** | Impossible de supprimer une carte utilisée |
| CARD → PRICEHISTORY | **DELETE** | Supprimer l'historique des prix |
| VARIANT → PRICEHISTORY | **DELETE** | Supprimer Prix spécifiques à la variante |
| VARIANT → COLLECTIONITEM | **Nullify** (variantId = NULL) | Garder l'item, juste sans variante précise |

---

## Intégrité Relationnelle : Le "Triangle" Card-Variant

**Problème critique** : COLLECTIONITEM, PRICEHISTORY, GRADINGRESULT et WISHLIST peuvent pointer vers une `variantId` qui n'appartient **pas** au `cardId` associé. Un utilisateur pourrait lier la variante "Holo" de **Pikachu** à la carte **Dracaufeu**.

### Contrainte CHECK - Vérifier l'appartenance de la variante

```sql
-- Ajouter une contrainte CHECK sur COLLECTIONITEM
ALTER TABLE COLLECTIONITEM
ADD CONSTRAINT check_variant_belongs_to_card
CHECK (
  variantId IS NULL 
  OR variantId IN (
    SELECT id FROM VARIANT WHERE cardId = COLLECTIONITEM.cardId
  )
);

-- Même contrainte sur PRICEHISTORY
ALTER TABLE PRICEHISTORY
ADD CONSTRAINT check_variant_belongs_to_card
CHECK (
  variantId IS NULL 
  OR variantId IN (
    SELECT id FROM VARIANT WHERE cardId = PRICEHISTORY.cardId
  )
);

-- Et sur GRADINGRESULT, WISHLIST
ALTER TABLE GRADINGRESULT
ADD CONSTRAINT check_variant_belongs_to_card
CHECK (
  variantId IS NULL 
  OR variantId IN (
    SELECT id FROM VARIANT WHERE cardId = GRADINGRESULT.cardId
  )
);

ALTER TABLE WISHLIST
ADD CONSTRAINT check_variant_belongs_to_card
CHECK (
  variantId IS NULL 
  OR variantId IN (
    SELECT id FROM VARIANT WHERE cardId = WISHLIST.cardId
  )
);
```

### Trigger alternatif (si contrainte CHECK pas supportée)

```sql
CREATE TRIGGER validate_variant_belongs_to_card_collectionitem
BEFORE INSERT OR UPDATE ON COLLECTIONITEM
FOR EACH ROW
BEGIN
  IF NEW.variantId IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM VARIANT 
      WHERE id = NEW.variantId AND cardId = NEW.cardId
    ) THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Variant does not belong to the specified Card';
    END IF;
  END IF;
END;
```

---

## Gestion de la Temporalité

### Contraintes de dates

```sql
-- SESSION : expiresAt doit être après createdAt
ALTER TABLE SESSION
ADD CONSTRAINT check_session_expiry
CHECK (expiresAt > createdAt);

-- SCANHISTORY : timestamp ne peut pas être dans le futur
ALTER TABLE SCANHISTORY
ADD CONSTRAINT check_scan_timestamp
CHECK (createdAt <= NOW());

-- PRICEHISTORY : timestamp cohérent
ALTER TABLE PRICEHISTORY
ADD CONSTRAINT check_price_timestamp
CHECK (timestamp <= NOW());
```

### Index pour optimiser les requêtes temporelles

```sql
-- Index composite pour trouver le prix le plus récent
CREATE INDEX idx_pricehistory_card_timestamp 
ON PRICEHISTORY(cardId, timestamp DESC);

-- Index pour PRICEHISTORY avec variante
CREATE INDEX idx_pricehistory_variant_timestamp 
ON PRICEHISTORY(cardId, variantId, timestamp DESC);

-- Index pour COLLECTIONITEM par collection
CREATE INDEX idx_collectionitem_collection 
ON COLLECTIONITEM(collectionId, cardId);

-- Index pour GRADINGRESULT récents
CREATE INDEX idx_gradingresult_creation 
ON GRADINGRESULT(userId, createdAt DESC);
```

### State Machine : Éviter les régressions de statut (SCANHISTORY)

Le statut d'un scan ne peut passer que dans cet ordre :
```
PENDING → PROCESSING → COMPLETED
                    ↘ FAILED (terminal)
```

```sql
CREATE TRIGGER validate_scan_status_transition
BEFORE UPDATE ON SCANHISTORY
FOR EACH ROW
BEGIN
  DECLARE invalid_transition BOOLEAN;
  
  SET invalid_transition = CASE
    WHEN OLD.status = 'COMPLETED' THEN TRUE  -- Terminal, pas de retour
    WHEN OLD.status = 'FAILED' THEN TRUE     -- Terminal, pas de retour
    WHEN OLD.status = 'PROCESSING' AND NEW.status = 'PENDING' THEN TRUE  -- Pas de régression
    ELSE FALSE
  END;
  
  IF invalid_transition THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = CONCAT('Invalid status transition: ', 
                              OLD.status, ' -> ', NEW.status);
  END IF;
END;
```

---

## Unicité et Prévention des Doublons Métier

### VARIANT : Une variante par (card, identifier)

```sql
-- Ajouter UNIQUE sur (cardId, label) pour éviter doublons
ALTER TABLE VARIANT
ADD CONSTRAINT uk_variant_card_label
UNIQUE (cardId, label);
-- Exemple : Pas deux "Holo" pour Pikachu
```

### COLLECTIONITEM : Gestion des exemplaires multiples

**Question clé** : Un utilisateur peut-il avoir plusieurs exemplaires d'une même carte en même condition ?

**Option 1** : Ajouter une colonne `quantity`

```sql
-- Modifier COLLECTIONITEM pour gérer plusieurs exemplaires
ALTER TABLE COLLECTIONITEM
ADD COLUMN quantity INT NOT NULL DEFAULT 1;

-- Contrainte : quantity >= 1
ALTER TABLE COLLECTIONITEM
ADD CONSTRAINT check_quantity_positive
CHECK (quantity >= 1);

-- UNIQUE sur (collectionId, cardId, variantId, condition)
-- Signification : "1 ligne = plusieurs exemplaires du même état"
ALTER TABLE COLLECTIONITEM
ADD CONSTRAINT uk_collectionitem_unique_state
UNIQUE (collectionId, cardId, variantId, condition);
```

**Option 2** : Garder la structure actuelle (une ligne = un exemplaire unique)

Si gradingResultId est renseigné → item est gradé (certificat unique) → pas de doublons
```sql
-- Contrainte : gradingResultId doit être UNIQUE
ALTER TABLE COLLECTIONITEM
ADD CONSTRAINT uk_collectionitem_grading
UNIQUE (gradingResultId);
-- Un certificat ne peut être attribué qu'à UN item
```

### PRICEHISTORY & DATASOURCE : Éviter les prix doublons

```sql
-- Une seule entrée par (cardId, variantId, sourceId, condition, date)
ALTER TABLE PRICEHISTORY
ADD CONSTRAINT uk_pricehistory_daily
UNIQUE (cardId, variantId, sourceId, condition, DATE(timestamp));
-- Évite d'insérer le même prix 2 fois le même jour
```

---

## Énumérations Avancées

### Currency : Gestion multi-devise

Au lieu d'utiliser 'EUR' en dur, créer une table de référence :

```sql
CREATE TABLE CURRENCY (
  code CHAR(3) PRIMARY KEY,  -- 'EUR', 'USD', 'JPY'
  name VARCHAR(50) NOT NULL,
  symbol VARCHAR(5) NOT NULL,
  isActive BOOLEAN DEFAULT TRUE
);

INSERT INTO CURRENCY VALUES
  ('EUR', 'Euro', '€', TRUE),
  ('USD', 'US Dollar', '$', TRUE),
  ('JPY', 'Japanese Yen', '¥', TRUE);

-- Ajouter FK dans COLLECTIONVALUEHISTORY
ALTER TABLE COLLECTIONVALUEHISTORY
ADD COLUMN currency CHAR(3) DEFAULT 'EUR',
ADD CONSTRAINT fk_currency
FOREIGN KEY (currency) REFERENCES CURRENCY(code);

-- Mettre à jour le trigger
-- Au lieu de : 'EUR', utiliser : COALESCE(NEW.currency, 'EUR')
```

### Condition Enum : Ordre et poids numériques

Créer une table de référence pour gérer l'ordre de sévérité :

```sql
CREATE TABLE CONDITION_REFERENCE (
  id INT PRIMARY KEY,
  name VARCHAR(20) NOT NULL UNIQUE,
  weight INT NOT NULL,
  description TEXT
);

INSERT INTO CONDITION_REFERENCE VALUES
  (1, 'NM', 10, 'Near Mint - État parfait'),
  (2, 'LP', 8,  'Lightly Played - Léger jeu'),
  (3, 'MP', 6,  'Moderately Played - Jeu modéré'),
  (4, 'HP', 4,  'Heavily Played - Beaucoup de jeu'),
  (5, 'DMG', 1, 'Damaged - Endommagé');

-- Utiliser dans les requêtes :
SELECT * FROM COLLECTIONITEM
JOIN CONDITION_REFERENCE ON COLLECTIONITEM.condition = CONDITION_REFERENCE.name
ORDER BY CONDITION_REFERENCE.weight DESC;
```

---

## Sécurité et Permissions SQL (DCL)

### Restrictions strictes sur les tables immuables

```sql
-- Créer un rôle pour l'application (write-only sur immuables)
CREATE ROLE app_user;

-- Permissions TRÈS restrictives sur AUDITLOG
GRANT INSERT ON AUDITLOG TO app_user;
REVOKE UPDATE, DELETE ON AUDITLOG FROM app_user;
REVOKE ALTER ON AUDITLOG FROM app_user;

-- Même pour PRICEHISTORY, GRADINGRESULT, SCANHISTORY
GRANT INSERT ON PRICEHISTORY TO app_user;
REVOKE UPDATE, DELETE ON PRICEHISTORY FROM app_user;

GRANT INSERT ON GRADINGRESULT TO app_user;
REVOKE UPDATE, DELETE ON GRADINGRESULT FROM app_user;

GRANT INSERT ON SCANHISTORY TO app_user;
REVOKE UPDATE, DELETE ON SCANHISTORY FROM app_user;

GRANT INSERT ON COLLECTIONVALUEHISTORY TO app_user;
REVOKE UPDATE, DELETE ON COLLECTIONVALUEHISTORY FROM app_user;

-- Le DBA seul peut faire des administrative operations
CREATE ROLE db_admin;
GRANT ALL PRIVILEGES ON *.* TO db_admin WITH GRANT OPTION;
```

### Audit complet : Logger même l'accès aux données sensibles

```sql
-- Trigger pour logger les SELECT sur données sensibles
CREATE TRIGGER audit_sensitive_read
AFTER SELECT ON USER  -- Syntaxe varianile selon SGBD
-- ⚠️ Note: La plupart des SGBD ne supportent pas AFTER SELECT sur TRIGGER
-- Alternative: Appliquer l'audit au niveau applicatif (middleware)
```

---

## Optimisation des Triggers

### Problème du trigger COLLECTION_VALUE_HISTORY_UPDATE

```sql
-- ❌ PROBLÈME : Recalcul complet à chaque INSERT
CREATE TRIGGER collection_value_history_update_OLD
AFTER INSERT OR DELETE OR UPDATE ON COLLECTIONITEM
FOR EACH ROW
BEGIN
  INSERT INTO COLLECTIONVALUEHISTORY (collectionId, totalValue, currency, timestamp)
  SELECT 
    ci.collectionId,
    SUM(c.predictedPrice),  -- ⚠️ Recalcul COMPLET si 5000 items
    'EUR',
    NOW()
  FROM COLLECTIONITEM ci
  LEFT JOIN CARD c ON ci.cardId = c.id
  WHERE ci.collectionId = COALESCE(NEW.collectionId, OLD.collectionId);
END;
```

### ✅ Solution 1 : Calcul différentiel

```sql
CREATE TRIGGER collection_value_history_update_OPTIMIZED
AFTER INSERT OR DELETE OR UPDATE ON COLLECTIONITEM
FOR EACH ROW
BEGIN
  DECLARE collection_id UUID;
  DECLARE price_delta FLOAT;
  
  -- Déterminer la collection
  SET collection_id = COALESCE(NEW.collectionId, OLD.collectionId);
  
  -- Calculer le delta
  IF NEW.id IS NOT NULL AND OLD.id IS NULL THEN
    -- INSERT : ajouter le prix de la carte
    SET price_delta = (SELECT predictedPrice FROM CARD WHERE id = NEW.cardId);
  ELSEIF OLD.id IS NOT NULL AND NEW.id IS NULL THEN
    -- DELETE : soustraire le prix
    SET price_delta = -(SELECT predictedPrice FROM CARD WHERE id = OLD.cardId);
  ELSE
    -- UPDATE : delta entre ancien et nouveau
    SET price_delta = (SELECT predictedPrice FROM CARD WHERE id = NEW.cardId)
                    - (SELECT predictedPrice FROM CARD WHERE id = OLD.cardId);
  END IF;
  
  -- Insérer le snapshot avec le nouveau total
  INSERT INTO COLLECTIONVALUEHISTORY (collectionId, totalValue, currency, timestamp)
  SELECT 
    collection_id,
    COALESCE((SELECT totalValue FROM COLLECTIONVALUEHISTORY 
              WHERE collectionId = collection_id 
              ORDER BY timestamp DESC LIMIT 1), 0) + price_delta,
    'EUR',
    NOW();
END;
```

### ✅ Solution 2 : Worker asynchrone (recommandé)

Au lieu de trigger synchrone, planifier un snapshot périodique :

```sql
-- Désactiver le trigger lourd
-- CREATE TRIGGER collection_value_history_update DISABLED;

-- Planifier un job asynchrone (via une table de queue)
INSERT INTO SNAPSHOT_QUEUE (collectionId, priority, timestamp)
VALUES (NEW.collectionId, 'HIGH', NOW());

-- Worker Python consulte SNAPSHOT_QUEUE toutes les 5 minutes et recalcule
-- Avantages : Pas de blocage transactionnel, permet batch processing
```


## Triggers SQL

### 1. Trigger : `COLLECTION_VALUE_HISTORY_UPDATE`

Quand un **COLLECTIONITEM** est ajouté/supprimé/modifié, recalculer et insérer un snapshot dans `COLLECTIONVALUEHISTORY`.

```sql
CREATE TRIGGER collection_value_history_update
AFTER INSERT OR DELETE OR UPDATE ON COLLECTIONITEM
FOR EACH ROW
BEGIN
  INSERT INTO COLLECTIONVALUEHISTORY (collectionId, totalValue, currency, timestamp)
  SELECT 
    ci.collectionId,
    COALESCE(SUM(c.predictedPrice), 0),
    'EUR',
    NOW()
  FROM COLLECTIONITEM ci
  LEFT JOIN CARD c ON ci.cardId = c.id
  WHERE ci.collectionId = COALESCE(NEW.collectionId, OLD.collectionId)
  GROUP BY ci.collectionId;
END;
```

---

### 2. Trigger : `AUDITLOG_ON_UPDATE`

Tracer **toute modification** sur les tables sensibles (USER, CARD, COLLECTION, etc.).

```sql
CREATE TRIGGER auditlog_on_user_update
AFTER UPDATE ON USER
FOR EACH ROW
BEGIN
  INSERT INTO AUDITLOG (userId, action, targetType, targetId, metadata, timestamp)
  VALUES (
    COALESCE(current_user_id(), NEW.id),
    'UPDATE',
    'USER',
    NEW.id,
    JSON_OBJECT(
      'old_email', OLD.email,
      'new_email', NEW.email,
      'old_isActive', OLD.isActive,
      'new_isActive', NEW.isActive
    ),
    NOW()
  );
END;
```

---

### 3. Trigger : `CASCADE_USER_SOFT_DELETE`

Quand un **USER** est soft-deleted (`isActive = false`), soft-deleter toutes ses **COLLECTION**.

```sql
CREATE TRIGGER cascade_user_soft_delete
AFTER UPDATE ON USER
FOR EACH ROW
WHEN (NEW.isActive = false AND OLD.isActive = true)
BEGIN
  UPDATE COLLECTION
  SET isActive = false
  WHERE userId = NEW.id;
  
  INSERT INTO AUDITLOG (userId, action, targetType, targetId, metadata, timestamp)
  VALUES (NEW.id, 'CASCADE_SOFT_DELETE', 'USER_COLLECTIONS', NEW.id, NULL, NOW());
END;
```

---

## Scénarios d'intégrité

### Scénario 1 : Supprimer une collection

**Avant** : Une collection contient 50 cartes

**Action** : `DELETE FROM COLLECTION WHERE id = X`

**Comportement attendu** :
-  Ne **pas** supprimer les COLLECTIONITEM
-  Marquer la collection comme inactive (`isActive = false`)
-  Garder l'historique de valeur dans COLLECTIONVALUEHISTORY
-  Insérer un audit log de la suppression

**Implémentation** :
```sql
UPDATE COLLECTION SET isActive = false WHERE id = X;
-- Trigger CASCADE_USER_SOFT_DELETE se déclenche automatiquement
```

---

### Scénario 2 : Ajouter une carte à une collection

**Action** : `INSERT INTO COLLECTIONITEM (collectionId, cardId, condition)`

**Comportement attendu** :
-  Vérifier que CARD.id existe
-  Si variantId fourni, vérifier que VARIANT.cardId = CARD.id
-  Recalculer COLLECTIONVALUEHISTORY (trigger)
-  Insérer un audit log

**Implémentation** :
```sql
INSERT INTO COLLECTIONITEM (collectionId, cardId, variantId, condition)
VALUES (?, ?, ?, 'NM')
-- Triggers se déclenchent automatiquement
```

**Validation avant INSERT** :
```sql
-- Vérifier que la carte existe
SELECT 1 FROM CARD WHERE id = ?;

-- Si variantId fourni, vérifier que variante appartient à la carte
SELECT 1 FROM VARIANT WHERE id = ? AND cardId = ?;
```

---

### Scénario 3 : Mettre à jour un prix (Worker Scraping)

**Action** : `INSERT INTO PRICEHISTORY (cardId, variantId, sourceId, price, condition, timestamp)`

**Comportement attendu** :
-  Toujours **INSERT**, jamais UPDATE
-  Garder l'historique complet des prix
-  Worker Python lit et agrège les prix
-  Backend recalcule CARD.predictedPrice via algorithme séparé

**Implémentation** :
```sql
INSERT INTO PRICEHISTORY (cardId, variantId, sourceId, price, currency, condition, timestamp)
VALUES (?, ?, ?, ?, 'EUR', 'NM', NOW());

-- Jamais d'UPDATE sur cette table
-- Les modifications créent des INSERT avec timestamp plus récent
```

**Agrégation des prix** (côté Python) :
```python
# Lire l'historique et calculer la moyenne
prices = db.query("""
  SELECT price FROM PRICEHISTORY
  WHERE cardId = ? AND timestamp > NOW() - INTERVAL 7 DAY
""")
predicted_price = mean(prices)

# Mettre à jour CARD.predictedPrice
db.update("CARD SET predictedPrice = ? WHERE id = ?", predicted_price, cardId)
```

---

### Scénario 4 : Révoquer une session (user logout / security)

**Action** : `UPDATE SESSION SET isRevoked = true WHERE id = X`

**Comportement attendu** :
-  Invalider le token immédiatement
-  Ne **pas** supprimer l'enregistrement (traçabilité)
-  Le user doit se reconnecter
-  Insérer un audit log optionnel

**Implémentation** :
```sql
UPDATE SESSION SET isRevoked = true WHERE id = X;

-- À chaque requête, vérifier :
SELECT 1 FROM SESSION 
WHERE id = ? AND isRevoked = false AND expiresAt > NOW();
```

---

### Scénario 5 : Analyser une carte (après scan OCR)

**Action** : `INSERT INTO GRADINGRESULT (...)`

**Comportement attendu** :
- ✅ Résultat immutable (jamais UPDATE/DELETE)
- ✅ Tracer la version du modèle ML (`modelVersion`)
- ✅ Optionnellement lier à un COLLECTIONITEM existant
- ✅ Insérer audit log de l'analyse

**Implémentation** :
```sql
-- Worker Python insère le résultat
INSERT INTO GRADINGRESULT (
  cardId, variantId, userId, scanId,
  score, centeringScore, cornersScore, edgesScore, surfaceScore,
  modelVersion, createdAt
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '1.2.0', NOW());

-- Backend optionnellement lie à une collection
UPDATE COLLECTIONITEM 
SET gradingResultId = ?
WHERE collectionId = ? AND cardId = ?;
-- Trigger COLLECTION_VALUE_HISTORY_UPDATE se déclenche
```

---

## Points critiques à vérifier

-  **Jamais modifier PRICEHISTORY, GRADINGRESULT, AUDITLOG, SCANHISTORY** (immutables)
-  **Toujours vérifier isActive = true** quand lire USER, COLLECTION, DATASOURCE
-  **Respect de la règle cardId/variantId** : si variantId, alors cardId doit être renseigné
-  **Déclencher les triggers manuellement si INSERT directement en SQL** (pas via ORM)
-  **Vérifier les contraintes CHECK** avant INSERT (scores entre 0-10, prix >= 0)
