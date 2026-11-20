import type { MouseEvent, MouseEventHandler, ReactNode } from 'react';

/** Variantes de Button (planche 08.1, §05.1). */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** Types natifs autorisés ; `button` par défaut pour éviter une soumission de formulaire accidentelle. */
export type ButtonType = 'button' | 'submit';

/** Propriétés communes à tous les boutons. */
interface ButtonBaseProps {
  /** Libellé, affiché en majuscules par le token `button-label`. */
  children: string;
  /** Variante visuelle ; danger est réservé aux actions destructrices irréversibles. */
  variant: ButtonVariant;
  /** Type natif du bouton. */
  type?: ButtonType;
  /** Occupe toute la largeur du conteneur. */
  fullWidth?: boolean;
  /** Désactive le bouton avec l'attribut natif. */
  disabled?: boolean;
  /** Icône fournie par l'appelant, placée à gauche du libellé ; Button n'importe aucun atome. */
  icon?: ReactNode;
  /** Appelé au clic, sauf pendant le chargement. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

/** Le libellé de chargement est obligatoire dès que le bouton peut charger. */
type ButtonLoadingProps =
  | { loading?: undefined; loadingLabel?: undefined }
  | {
      /** Remplace le contenu par `loadingLabel`, sans spinner, à largeur figée, et ignore les clics. */
      loading: boolean;
      /**
       * Libellé au présent de l'indicatif (« Envoi… »), au plus aussi long que le libellé normal :
       * sa place est réservée même hors chargement, et le Button mobile ne la réservera pas.
       */
      loadingLabel: string;
    };

/** Propriétés de Button. */
export type ButtonProps = ButtonBaseProps & ButtonLoadingProps;

/** Bordure toujours présente, transparente au repos sur primary et ghost : aucun saut au survol. */
const BASE_CLASSES =
  'inline-flex h-control items-center justify-center whitespace-nowrap rounded-none border px-space-16 text-button-label transition-colors duration-instant';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-signal text-archive',
  secondary: 'border-acier-texte bg-transparent text-archive',
  ghost: 'border-transparent bg-transparent text-archive',
  danger: 'border-alerte/lisere-active bg-transparent text-alerte',
};

/** Retour par le liséré uniquement, toujours plus marqué que le repos : ni ombre, ni pression. */
const FEEDBACK_CLASSES: Record<ButtonVariant, string> = {
  primary: 'hover:border-lisere-hover active:border-lisere-active',
  secondary: 'hover:border-lisere-active active:border-archive',
  ghost: 'hover:border-lisere-hover active:border-lisere-active',
  danger: 'hover:border-alerte active:border-alerte',
};

const FULL_WIDTH_CLASSES = 'w-full';
const DISABLED_CLASSES = 'opacity-disabled';

/**
 * Le contenu (icône + libellé) et le libellé de chargement partagent la même cellule de grille,
 * l'un des deux étant masqué : le bouton prend la largeur du plus long, sans mesure ni style inline,
 * et ne change pas de taille au passage en chargement. Chaque couche centre son contenu.
 */
const LAYERS_CLASSES = 'grid';
const CONTENT_CLASSES =
  'col-start-1 row-start-1 inline-flex items-center justify-center gap-space-8';
const HIDDEN_CONTENT_CLASSES = `${CONTENT_CLASSES} invisible`;
const LOADING_LABEL_CLASSES = 'col-start-1 row-start-1 text-center';
const HIDDEN_LOADING_LABEL_CLASSES = `${LOADING_LABEL_CLASSES} invisible`;

const ICON_CLASSES = 'inline-flex shrink-0';

/**
 * Bouton d'action du design system, rendu par un `<button>` natif.
 * Couleurs, hauteur, espacements, typographie et durée viennent des tokens ;
 * le focus visible reste celui de la règle globale `:focus-visible`.
 */
export function Button({
  children,
  variant,
  type = 'button',
  fullWidth = false,
  disabled = false,
  icon,
  onClick,
  loading = false,
  loadingLabel,
}: ButtonProps) {
  const isInteractive = !disabled && !loading;
  const className = [
    BASE_CLASSES,
    VARIANT_CLASSES[variant],
    isInteractive && FEEDBACK_CLASSES[variant],
    fullWidth && FULL_WIDTH_CLASSES,
    disabled && DISABLED_CLASSES,
  ]
    .filter(Boolean)
    .join(' ');

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (loading) {
      // preventDefault bloque aussi la soumission du formulaire d'un bouton `submit`.
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  return (
    <button
      type={type}
      className={className}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={handleClick}
    >
      <span className={LAYERS_CLASSES}>
        <span className={loading ? HIDDEN_CONTENT_CLASSES : CONTENT_CLASSES}>
          {icon !== undefined && (
            <span aria-hidden="true" className={ICON_CLASSES}>
              {icon}
            </span>
          )}
          <span>{children}</span>
        </span>
        {loadingLabel !== undefined && (
          <span className={loading ? LOADING_LABEL_CLASSES : HIDDEN_LOADING_LABEL_CLASSES}>
            {loadingLabel}
          </span>
        )}
      </span>
    </button>
  );
}
