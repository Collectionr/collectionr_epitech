import { ProgressBar, Text } from '@/components/atoms';
import { getPasswordStrength, PASSWORD_STRENGTH_LABELS } from '@shared/validation';
import type { PasswordStrength as PasswordStrengthLevel } from '@shared/validation';

/** Propriétés de PasswordStrength. */
export interface PasswordStrengthProps {
  /** Mot de passe en cours de saisie, évalué à chaque frappe. */
  password: string;
}

/** Niveaux du plus faible au plus solide : leur rang remplit la jauge par tiers. */
const LEVELS: readonly PasswordStrengthLevel[] = ['faible', 'correct', 'solide'];

/** Préfixe lu par les lecteurs d'écran : le libellé visible seul (« Faible ») manque de contexte. */
const ANNOUNCEMENT_PREFIX = 'Robustesse du mot de passe : ';

/** Nom de la jauge, exigé par ProgressBar ; la jauge est décorative, le libellé porte l'information. */
const GAUGE_LABEL = 'Robustesse du mot de passe';

const ROOT_CLASSES = 'flex items-center gap-space-12';

const GAUGE_CLASSES = 'flex-1';

/**
 * Les trois libellés partagent la même cellule de grille, seul le courant est visible :
 * la place du plus long est réservée, la jauge ne change pas de largeur quand le libellé apparaît.
 */
const LABELS_CLASSES = 'grid';
const LABEL_CLASSES = 'col-start-1 row-start-1';
const HIDDEN_LABEL_CLASSES = `${LABEL_CLASSES} invisible`;

/** Région lue par les lecteurs d'écran ; son texte ne change qu'au changement de niveau. */
const ANNOUNCEMENT_CLASSES = 'sr-only';

/**
 * Robustesse du mot de passe, mise à jour à chaque frappe : jauge Archive remplie par tiers
 * (Faible, Correct, Solide), toujours accompagnée de son libellé, la couleur ne portant aucun sens.
 * Le calcul vient de `@shared/validation` ; rien n'est affiché tant que le champ est vide.
 * Un changement de niveau est annoncé poliment aux lecteurs d'écran, une seule fois.
 */
export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = getPasswordStrength(password);
  const filledThirds = strength === null ? 0 : LEVELS.indexOf(strength) + 1;

  return (
    <div className={ROOT_CLASSES}>
      <span aria-hidden="true" className={GAUGE_CLASSES}>
        <ProgressBar value={filledThirds} max={LEVELS.length} aria-label={GAUGE_LABEL} />
      </span>
      <span aria-hidden="true" className={LABELS_CLASSES}>
        {LEVELS.map((level) => (
          <span key={level} className={level === strength ? LABEL_CLASSES : HIDDEN_LABEL_CLASSES}>
            <Text variant="caption">{PASSWORD_STRENGTH_LABELS[level]}</Text>
          </span>
        ))}
      </span>
      <span aria-live="polite" className={ANNOUNCEMENT_CLASSES}>
        {strength === null ? '' : `${ANNOUNCEMENT_PREFIX}${PASSWORD_STRENGTH_LABELS[strength]}`}
      </span>
    </div>
  );
}
