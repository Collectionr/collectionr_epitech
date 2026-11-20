import { Text } from '../Text';

/** Propriétés de Label. */
export interface LabelProps {
  /** Id du champ associé ; obligatoire : un label orphelin ne compile pas. */
  htmlFor: string;
  /** Intitulé du champ (« Adresse e-mail »). */
  children: string;
  /**
   * Affiche un astérisque décoratif, masqué aux lecteurs d'écran : l'obligation est portée
   * par l'attribut `required` du champ, pas par l'astérisque.
   */
  required?: boolean;
}

const REQUIRED_MARK = '*';

/** L'espacement avec le champ (space-8) est géré par la molecule qui assemble Label et Input. */
const LABEL_CLASSES = 'inline-flex items-baseline gap-space-4';

/**
 * Intitulé de champ de formulaire, rendu par un `<label>` natif relié au champ par `htmlFor`.
 * Typographie caption en Archive ; astérisque en acier-texte, jamais en Alerte ni en Signal.
 */
export function Label({ htmlFor, children, required = false }: LabelProps) {
  return (
    <label htmlFor={htmlFor} className={LABEL_CLASSES}>
      <Text variant="caption">{children}</Text>
      {required && (
        <span aria-hidden="true">
          <Text variant="caption" color="acier-texte">
            {REQUIRED_MARK}
          </Text>
        </span>
      )}
    </label>
  );
}
