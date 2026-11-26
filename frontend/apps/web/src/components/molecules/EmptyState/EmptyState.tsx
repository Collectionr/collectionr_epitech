import { fontWeights } from '@shared/tokens';

import { Button, Icon, Text } from '../../atoms';
import type { IconName } from '../../atoms';

/** Action suggérée par un état vide (« Ajouter une carte »). */
export interface EmptyStateAction {
  /** Intitulé du bouton. */
  label: string;
  /** Appelée au clic. */
  onClick: () => void;
}

interface EmptyStateBaseProps {
  /** Ce qui manque, ton actif et concret (« Aucune carte dans cette collection »). */
  title: string;
  /** Précision facultative. */
  description?: string;
  /** Icône facultative, au-dessus du titre. */
  icon?: IconName;
}

/** Propriétés de EmptyState : rien encore (`empty`) ou aucun résultat (`no-results`). */
export type EmptyStateProps = EmptyStateBaseProps &
  (
    | {
        /** Rien encore : action suggérée facultative. */
        variant?: 'empty';
        action?: EmptyStateAction;
        onClearSearch?: undefined;
      }
    | {
        /** Recherche ou filtre sans résultat : « Effacer la recherche » quand `onClearSearch` est fourni. */
        variant: 'no-results';
        onClearSearch?: () => void;
        action?: undefined;
      }
  );

/**
 * Centré dans son conteneur, largeur de lecture limitée. Apparition en fondu (`animate-fade-in`,
 * seule animation d'apparition du design system), supprimée si les animations sont réduites.
 */
const ROOT_CLASSES =
  'mx-auto flex w-full max-w-form animate-fade-in flex-col items-center gap-space-12 p-space-24 text-center';

/**
 * Message et action suggérée quand une liste est vide (WF-D10). L'écran ne l'affiche qu'une fois
 * le chargement terminé, jamais en flash pendant un fetch.
 */
export function EmptyState(props: EmptyStateProps) {
  const { title, description, icon } = props;
  const action =
    props.variant === 'no-results'
      ? props.onClearSearch && { label: 'Effacer la recherche', onClick: props.onClearSearch }
      : props.action;

  return (
    <div className={ROOT_CLASSES}>
      {icon !== undefined && (
        <span className="text-acier-texte">
          <Icon name={icon} size="lg" />
        </span>
      )}
      <Text variant="body" weight={fontWeights.bold}>
        {title}
      </Text>
      {description !== undefined && (
        <Text variant="body" color="acier-texte">
          {description}
        </Text>
      )}
      {action !== undefined && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
