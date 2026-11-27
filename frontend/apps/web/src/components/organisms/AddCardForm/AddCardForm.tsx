import { useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';

import {
  CARD_CONDITION_LABELS,
  CARD_CONDITIONS,
  CARD_LANGUAGE_LABELS,
  CARD_LANGUAGES,
} from '@shared/constants';
import type { CardCondition, CardLanguage, Collection } from '@shared/types';

import { Button, Select } from '../../atoms';
import { FormField, QuantityStepper } from '../../molecules';

/** Valeurs du formulaire ; l'état reste vide tant qu'il n'est pas choisi. */
export interface AddCardFormValues {
  /** Collection de destination. */
  collectionId: string;
  /** État déclaré, vide tant qu'il n'est pas choisi. */
  condition: CardCondition | '';
  /** Langue de la carte physique. */
  language: CardLanguage;
  /** Nombre d'exemplaires. */
  quantity: number;
}

/** Valeurs envoyées : l'état est choisi. */
export type AddCardFormSubmission = AddCardFormValues & { condition: CardCondition };

/** Propriétés d'AddCardForm. */
export interface AddCardFormProps {
  /** Collections proposées comme destination. */
  collections: readonly Pick<Collection, 'id' | 'name'>[];
  /** Valeurs courantes, contrôlées par la page. */
  values: AddCardFormValues;
  /** Reçoit les valeurs modifiées. */
  onChange: (values: AddCardFormValues) => void;
  /** Une carte est choisie : sans elle, « Enregistrer » reste désactivé. */
  cardSelected: boolean;
  /** Envoi en cours : champs désactivés, « Enregistrer » affiche « Ajout… ». */
  submitting?: boolean;
  /** Reçoit les valeurs validées. */
  onSubmit: (values: AddCardFormSubmission) => void;
  /** « Annuler » : la page revient à la précédente. */
  onCancel: () => void;
}

const CONDITION_OPTIONS = CARD_CONDITIONS.map((condition) => ({
  value: condition,
  label: CARD_CONDITION_LABELS[condition],
}));

const LANGUAGE_OPTIONS = CARD_LANGUAGES.map((language) => ({
  value: language,
  label: CARD_LANGUAGE_LABELS[language],
}));

const MESSAGES = {
  collection: 'Choisissez une collection.',
  condition: 'Choisissez l’état de la carte.',
} as const;

type FieldErrors = Partial<Record<'collection' | 'condition', string>>;

/** Erreurs sans celle du champ corrigé. */
function withoutError(errors: FieldErrors, field: keyof FieldErrors): FieldErrors {
  const next = { ...errors };
  delete next[field];
  return next;
}

function isCondition(value: string): value is CardCondition {
  return CARD_CONDITIONS.some((condition) => condition === value);
}

function isLanguage(value: string): value is CardLanguage {
  return CARD_LANGUAGES.some((language) => language === value);
}

/**
 * Formulaire de l'Ajout manuel : collection, état, langue et quantité, alignés sur la validation
 * du back. Il reçoit tout par props, sans appel de données. « Enregistrer » reste désactivé tant
 * qu'aucune carte n'est choisie ; Entrée dans le dernier champ (quantité) enregistre. Une
 * collection absente de la liste proposée ou un état manquant est signalé à l'envoi, focus sur le
 * champ : l'envoi n'est jamais abandonné sans message.
 */
export function AddCardForm({
  collections,
  values,
  onChange,
  cardSelected,
  submitting = false,
  onSubmit,
  onCancel,
}: AddCardFormProps) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const collectionRef = useRef<HTMLSelectElement>(null);
  const conditionRef = useRef<HTMLSelectElement>(null);

  function update(changes: Partial<AddCardFormValues>) {
    onChange({ ...values, ...changes });
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cardSelected || submitting) {
      return;
    }
    const { condition } = values;
    const collectionListed = collections.some(({ id }) => id === values.collectionId);
    const nextErrors: FieldErrors = {
      ...(!collectionListed && { collection: MESSAGES.collection }),
      ...(condition === '' && { condition: MESSAGES.condition }),
    };
    setErrors(nextErrors);
    if (nextErrors.collection !== undefined) {
      collectionRef.current?.focus();
      return;
    }
    if (condition === '') {
      conditionRef.current?.focus();
      return;
    }
    onSubmit({ ...values, condition });
  }

  return (
    <form noValidate className="flex flex-col gap-space-16" onSubmit={handleSubmit}>
      <FormField
        label="Collection"
        required
        error={errors.collection}
        renderControl={(control) => (
          <Select
            {...control}
            ref={collectionRef}
            disabled={submitting}
            value={values.collectionId}
            placeholder="Choisir une collection"
            options={collections.map(({ id, name }) => ({ value: id, label: name }))}
            onChange={(collectionId) => {
              setErrors((current) => withoutError(current, 'collection'));
              update({ collectionId });
            }}
          />
        )}
      />
      <FormField
        label="État"
        required
        error={errors.condition}
        renderControl={(control) => (
          <Select
            {...control}
            ref={conditionRef}
            disabled={submitting}
            value={values.condition}
            placeholder="Choisir un état"
            options={CONDITION_OPTIONS}
            onChange={(condition) => {
              if (isCondition(condition)) {
                setErrors((current) => withoutError(current, 'condition'));
                update({ condition });
              }
            }}
          />
        )}
      />
      <FormField
        label="Langue"
        required
        renderControl={(control) => (
          <Select
            {...control}
            value={values.language}
            disabled={submitting}
            options={LANGUAGE_OPTIONS}
            onChange={(language) => {
              if (isLanguage(language)) {
                update({ language });
              }
            }}
          />
        )}
      />
      <FormField
        label="Quantité"
        required
        renderControl={(control) => (
          <QuantityStepper
            id={control.id}
            required={control.required}
            disabled={submitting}
            value={values.quantity}
            onChange={(quantity) => update({ quantity })}
          />
        )}
      />
      <div className="flex flex-wrap items-center gap-space-12">
        <Button
          type="submit"
          variant="primary"
          disabled={!cardSelected}
          loading={submitting}
          loadingLabel="Ajout…"
        >
          Enregistrer
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
