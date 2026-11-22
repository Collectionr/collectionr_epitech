import { useId } from 'react';
import type { ReactNode } from 'react';

import { Input, Label } from '@/components/atoms';
import type { InputProps } from '@/components/atoms';

/** Ce que FormField transmet au contrôle du champ, qu'il s'agisse d'Input ou d'un contrôle fourni. */
export interface FormFieldControlProps {
  /** Id du contrôle, relié au Label ; base de l'id du message d'erreur rendu par Input. */
  id: string;
  /** Champ obligatoire : à poser sur l'attribut natif `required` du contrôle. */
  required: boolean;
  /** Message d'erreur fourni par le formulaire, à passer à Input qui le rend. */
  error?: string;
}

/** Propriétés communes aux deux usages de FormField. */
interface FormFieldBaseProps {
  /** Intitulé du champ (« Adresse e-mail »). */
  label: string;
  /** Id du contrôle ; généré (`useId`) par défaut, à fixer pour y placer le focus depuis le formulaire. */
  id?: string;
  /** Champ obligatoire : astérisque du Label et attribut `required` du contrôle. */
  required?: boolean;
  /** Message d'erreur fourni par le formulaire ; FormField ne valide rien. */
  error?: string;
}

/** Propriétés d'Input que FormField laisse au formulaire ; le reste est géré par FormField. */
type InputFieldProps = Omit<InputProps, 'id' | 'required' | 'error' | 'type' | 'trailing'> & {
  /** Type natif ; le mot de passe passe par `renderControl` et PasswordField. */
  type?: 'text' | 'email';
};

/** Interdit un groupe de propriétés : elles ne peuvent pas accompagner `renderControl`. */
type Forbidden<T> = { [K in keyof T]?: never };

/** Champ standard : FormField rend un Input, avec les propriétés d'Input reçues. */
type FormFieldWithInputProps = FormFieldBaseProps &
  InputFieldProps & {
    renderControl?: undefined;
  };

/**
 * Champ à contrôle fourni (PasswordField) : le contrôle remplace Input et reçoit `id`, `required`
 * et `error`. Les propriétés d'Input sont alors passées au contrôle, pas à FormField.
 */
type FormFieldWithControlProps = FormFieldBaseProps &
  Forbidden<InputFieldProps> & {
    /** Rend le contrôle du champ à partir de ce que FormField lui transmet. */
    renderControl: (control: FormFieldControlProps) => ReactNode;
  };

/** Propriétés de FormField : Input par défaut, ou un contrôle fourni par `renderControl`, jamais les deux. */
export type FormFieldProps = FormFieldWithInputProps | FormFieldWithControlProps;

/** Label au-dessus du contrôle, à `space-8`. */
const ROOT_CLASSES = 'flex flex-col gap-space-8';

/**
 * Champ de formulaire complet : Label, contrôle et message d'erreur en un bloc.
 * Les écrans n'assemblent jamais Label et Input eux-mêmes. Le message et son lien
 * `aria-describedby` sont rendus par Input : un seul message, quel que soit le contrôle.
 * La validation (au blur) reste au formulaire, qui reçoit `onBlur` et renvoie `error`.
 */
export function FormField(props: FormFieldProps) {
  const generatedId = useId();
  const { label, id: idProp, required: requiredProp, error, renderControl, ...inputProps } = props;
  const control: FormFieldControlProps = {
    id: idProp ?? generatedId,
    required: requiredProp ?? false,
    error,
  };

  return (
    <div className={ROOT_CLASSES}>
      <Label htmlFor={control.id} required={control.required}>
        {label}
      </Label>
      {renderControl === undefined ? (
        <Input {...inputProps} {...control} />
      ) : (
        renderControl(control)
      )}
    </div>
  );
}
