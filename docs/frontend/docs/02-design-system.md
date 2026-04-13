> **Maintenu par :** Francois Dubois (PO / Frontend Lead)
> **Derniere mise a jour :** 2026-03-22
> **Audience :** Toute l'equipe, en particulier les nouveaux contributeurs

# Design System -- CollectionR

Ce document est la reference unique pour la charte graphique. Toute couleur, espacement ou typographie doit venir d'ici. Aucune valeur magique (hex en dur, taille en pixels arbitraire) ne doit apparaitre dans le code sans etre definie dans ce design system.

---

## 1. Palette de couleurs

Chaque couleur a un token Tailwind correspondant. Utiliser toujours le token, jamais la valeur hex directement.

| Nom | Token Tailwind | Hex | Utilisation | (à confirmer une fois la maquette finis)
|---|---|---|---|
| Primary | `primary` | `#3B82F6` | Actions principales, liens, boutons CTA |
| Primary Dark | `primary-dark` | `#2563EB` | Hover et active sur les elements primaires |
| Secondary | `secondary` | `#8B5CF6` | Elements secondaires, badges de rarete |
| Success | `success` | `#22C55E` | Confirmation, ajout reussi, prix en hausse |
| Warning | `warning` | `#F59E0B` | Avertissements, etat moyen d'une carte |
| Error | `error` | `#EF4444` | Erreurs, suppression, prix en baisse |
| Background | `bg-app` | `#F8FAFC` | Arriere-plan principal de l'application |
| Surface | `surface` | `#FFFFFF` | Arriere-plan des cartes, modals, panels |
| Surface Alt | `surface-alt` | `#F1F5F9` | Arriere-plan alternatif (lignes paires, sections) |
| Text | `text-primary` | `#0F172A` | Texte principal, titres, corps de texte |
| Text Muted | `text-muted` | `#64748B` | Texte secondaire, labels, descriptions |
| Text Inverted | `text-inverted` | `#FFFFFF` | Texte sur fond sombre ou colore |
| Border | `border-default` | `#E2E8F0` | Bordures par defaut, separateurs |

### Mode sombre (prevu pour la phase 2)

Les tokens seront inverses via les variables CSS Tailwind. Le code n'a pas besoin de changer si les tokens sont utilises correctement.

---

## 2. Typographie

Le choix de la police est guide par la lisibilite sur ecran et la compatibilite cross-platform.

### Police principale

```
Font family : Inter
Fallback    : -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
```

### Echelle de tailles

| Token | Taille | Line Height | Utilisation |
|---|---|---|---|
| `text-xs` | 12px | 16px | Mentions legales, metadata secondaire |
| `text-sm` | 14px | 20px | Labels, descriptions, texte secondaire |
| `text-base` | 16px | 24px | Corps de texte principal |
| `text-lg` | 18px | 28px | Sous-titres, noms de cartes dans les listes |
| `text-xl` | 20px | 28px | Titres de sections |
| `text-2xl` | 24px | 32px | Titres de pages |
| `text-3xl` | 30px | 36px | Titres principaux, valeur totale de collection |

### Regles d'usage

| Element | Taille | Poids | Token Tailwind |
|---|---|---|---|
| Titre de page | `text-2xl` | Bold | `text-2xl font-bold` |
| Titre de section | `text-xl` | Semibold | `text-xl font-semibold` |
| Nom de carte | `text-lg` | Semibold | `text-lg font-semibold` |
| Corps de texte | `text-base` | Normal | `text-base font-normal` |
| Label de formulaire | `text-sm` | Medium | `text-sm font-medium` |
| Prix | `text-lg` | Bold | `text-lg font-bold` |
| Description, metadata | `text-sm` | Normal | `text-sm text-muted` |

---

## 3. Espacements

L'unite de base est 4px. Tous les espacements sont des multiples de cette unite pour garantir un rythme visuel coherent.

| Token Tailwind | Valeur | Utilisation courante |
|---|---|---|
| `p-1` / `gap-1` | 4px | Espacement minimal entre icone et texte |
| `p-2` / `gap-2` | 8px | Padding interne des badges, espacement entre elements proches |
| `p-3` / `gap-3` | 12px | Espacement entre elements de formulaire |
| `p-4` / `gap-4` | 16px | Padding interne des cartes, espacement standard |
| `p-5` / `gap-5` | 20px | Padding des sections |
| `p-6` / `gap-6` | 24px | Marge entre blocs de contenu |
| `p-8` / `gap-8` | 32px | Marge entre sections majeures |
| `p-12` / `gap-12` | 48px | Espacement vertical entre grandes sections de page |

### Convention par composant

| Composant | Padding interne | Gap entre enfants |
|---|---|---|
| Bouton | `px-4 py-2` | `gap-2` (icone + texte) |
| Carte (card) | `p-4` | `gap-3` |
| Section de page | `p-6` | `gap-4` |
| Modal | `p-6` | `gap-4` |
| Liste d'items | -- | `gap-3` |

---

## 4. Border radius

La coherence des arrondis contribue a l'identite visuelle. Utiliser toujours les tokens, jamais de valeurs arbitraires.

| Element | Token Tailwind | Valeur |
|---|---|---|
| Boutons | `rounded-lg` | 8px |
| Cartes (card) | `rounded-xl` | 12px |
| Inputs | `rounded-lg` | 8px |
| Badges | `rounded-full` | 9999px |
| Modals | `rounded-2xl` | 16px |
| Images de cartes | `rounded-lg` | 8px |
| Avatars | `rounded-full` | 9999px |

---

## 5. Ombres

Les ombres creent la hierarchie visuelle en simulant la profondeur. Chaque niveau correspond a un usage precis.

| Element | Token Tailwind | Utilisation |
|---|---|---|
| Cartes au repos | `shadow-sm` | Elevation legere, element au niveau de la surface |
| Cartes au hover | `shadow-md` | Retour visuel au survol |
| Dropdowns, popovers | `shadow-lg` | Element flottant au-dessus du contenu |
| Modals | `shadow-xl` | Element en superposition avec un backdrop |
| Cartes glissees (drag) | `shadow-2xl` | Element en cours de deplacement |

---

## 6. Icones

Les icones sont utilisees pour renforcer la comprehension sans remplacer le texte. Elles sont toujours accompagnees d'un label accessible.

### Bibliotheque

```
Lucide Icons (lucide-react / lucide-react-native)
```

Lucide est choisie pour sa coherence visuelle, sa legerte et sa compatibilite React Native.

### Tailles standard

| Taille | Valeur | Utilisation |
|---|---|---|
| Small | 16px | Icones inline dans le texte, badges |
| Medium | 20px | Icones de boutons, icones de navigation |
| Large | 24px | Icones de tab bar, icones d'actions principales |

### Convention d'utilisation

```typescript
import { Search, Plus, Trash2 } from 'lucide-react';

// Toujours specifier la taille et l'accessibilite
<Search size={20} aria-label="Rechercher" />
```

---

## 7. Prix et valeurs monetaires

Les prix sont un element central de l'application. Leur mise en forme doit etre immediatement reconnaissable et coherente.

### Format d'affichage

```
Format : X,XX EUR
Separateur decimal : virgule
Separateur milliers : espace
Symbole : EUR apres le montant
```

### Couleurs selon la tendance

| Tendance | Couleur | Token | Exemple |
|---|---|---|---|
| Hausse | Vert | `text-success` | `+2,50 EUR` |
| Baisse | Rouge | `text-error` | `-1,30 EUR` |
| Stable | Gris | `text-muted` | `0,00 EUR` |

### Exemple de composant PriceTag

```typescript
interface PriceTagProps {
  value: number;
  trend?: 'up' | 'down' | 'stable';
  currency?: string;
}

function PriceTag({ value, trend = 'stable', currency = 'EUR' }: PriceTagProps) {
  const trendClasses = {
    up: 'text-success',
    down: 'text-error',
    stable: 'text-muted',
  };

  const prefix = trend === 'up' ? '+' : trend === 'down' ? '-' : '';

  return (
    <Text className={`text-lg font-bold ${trendClasses[trend]}`}>
      {prefix}{formatPrice(Math.abs(value), currency)}
    </Text>
  );
}
```

---

## 8. Etats des composants

Chaque composant interactif doit gerer tous les etats suivants. Un composant sans etat loading ou disabled est incomplet.

| Etat | Description | Style |
|---|---|---|
| Default | Etat normal, au repos | Couleurs de base du composant |
| Hover | Survol souris (web uniquement) | Legere modification de couleur ou ombre (`hover:bg-primary-dark`) |
| Focus | Navigation clavier ou tap | Ring visible (`focus:ring-2 focus:ring-primary`) |
| Active | Pendant le clic ou le tap | Scale reduit (`active:scale-[0.97]`) |
| Disabled | Interaction impossible | Opacite reduite (`opacity-50 cursor-not-allowed`) |
| Loading (skeleton) | Donnees en cours de chargement | Bloc gris anime (`bg-surface-alt animate-pulse`) |
| Loading (spinner) | Action en cours (envoi, suppression) | Icone de chargement tournant a la place du contenu |
| Error | Erreur de validation ou de chargement | Bordure rouge, message d'erreur (`border-error text-error`) |

### Skeleton / Shimmer

Tout composant qui affiche des donnees asynchrones doit avoir un skeleton correspondant. Le skeleton reproduit la forme du composant final avec des blocs gris animes.

```typescript
// Skeleton d'un CardPreview
function CardPreviewSkeleton() {
  return (
    <View className="rounded-xl p-4 bg-surface">
      <View className="w-full h-48 rounded-lg bg-surface-alt animate-pulse" />
      <View className="h-5 w-3/4 mt-3 rounded bg-surface-alt animate-pulse" />
      <View className="h-4 w-1/2 mt-2 rounded bg-surface-alt animate-pulse" />
    </View>
  );
}
```

---

## 9. Comment etendre le design system

Si tu dois ajouter un nouveau token (couleur, taille, espacement), suis ces etapes. Le but est d'eviter l'accumulation de valeurs ad hoc qui finissent par creer de l'incoherence.

1. **Verifie si un token existant convient** -- Avant d'ajouter une nouvelle couleur ou taille, verifie que le design system actuel ne couvre pas deja le besoin.

2. **Propose le token dans une PR dediee** -- Ne glisse pas un nouveau token dans une PR de feature. Cree une PR specifique qui modifie le design system et ce document.

3. **Ajoute le token dans trois endroits** :
   - `styles/tailwind.config.ts` -- Pour le rendre disponible en tant que classe Tailwind
   - `styles/theme.ts` -- Pour le rendre disponible programmatiquement
   - Ce document (`02-design-system.md`) -- Pour le documenter

4. **Respecte les conventions** :
   - Noms en anglais, en kebab-case (`surface-alt`, pas `SurfaceAlt`)
   - Toujours un cas d'usage clair (pas de token "au cas ou")
   - Coherence avec l'echelle existante (pas de `p-7` si `p-6` et `p-8` existent)

---

## 10. Animations et feedback visuel

Cette section couvre les regles essentielles d'animation. Les animations existent pour donner du feedback a l'utilisateur, pas pour decorer. Toute animation doit avoir un but (feedback, orientation, plaisir d'usage). Une animation purement decorative sans fonction est interdite.

### Skeleton loaders -- regle obligatoire

Tout composant qui charge des donnees doit avoir un skeleton loader. Ne jamais laisser un composant vide ou avec un spinner generique. Le skeleton reproduit la forme du contenu final avec des blocs gris animes.

Exemple avec Tailwind animate-pulse :

```tsx
// CardPreviewSkeleton.tsx
export function CardPreviewSkeleton() {
  return (
    <div className="rounded-lg bg-surface p-3 animate-pulse">
      <div className="h-40 w-full rounded bg-muted mb-3" />
      <div className="h-4 w-3/4 rounded bg-muted mb-2" />
      <div className="h-4 w-1/2 rounded bg-muted" />
    </div>
  );
}
```

### Durees standard

La coherence des durees evite l'effet "chaque element a sa propre vitesse" qui fatigue visuellement.

| Nom | Duree | Usage |
|---|---|---|
| fast | 150ms | Hover, focus, micro-interactions |
| normal | 250ms | Transitions de composants, modals |
| slow | 400ms | Apparition de pages, resultats de scan |

### Accessibilite -- prefers-reduced-motion

Toujours respecter la preference systeme de l'utilisateur. Ne jamais forcer une animation si l'utilisateur a desactive les animations.

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

En React Native, utiliser `AccessibilityInfo.isReduceMotionEnabled()` pour detecter la preference et desactiver les animations en consequence.

---

## Voir aussi

- [03-composants.md](./03-composants.md) -- Comment les tokens sont appliques dans les composants
- [04-conventions-code.md](./04-conventions-code.md) -- Regles TypeScript et nommage
- [05-data-et-etat.md](./05-data-et-etat.md) -- Gestion d'etat et data fetching
- [01-architecture.md](./01-architecture.md) -- Ou placer les fichiers de configuration du theme
