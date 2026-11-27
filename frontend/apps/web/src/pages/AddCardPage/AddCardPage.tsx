import { useEffect, useRef, useState } from 'react';

import { Link, useNavigate, useSearchParams } from 'react-router';

import { Button, Text } from '@/components/atoms';
import { EmptyState } from '@/components/molecules';
import { AddCardForm, CardPreviewPanel, CatalogSearch } from '@/components/organisms';
import type { AddCardFormSubmission, AddCardFormValues } from '@/components/organisms';
import { readLastCollection, writeLastCollection } from '@/config/lastCollectionStorage';
import { DelayedLoadingLabel } from '@/router/DelayedLoadingLabel';
import { ADD_CARD_COLLECTION_PARAM, collectionPath, ROUTES } from '@/router/routes';
import { usePageTitle } from '@/router/usePageTitle';
import { useAddCardEntry, useAuth, useCollections, useSearchCatalog } from '@shared/hooks';
import { toast } from '@shared/stores';
import type { CatalogCard, Collection } from '@shared/types';
import { translateAddCardError } from '@shared/utils';

/** Valeurs de départ ; la collection est présélectionnée tant que l'utilisateur n'en choisit pas. */
const INITIAL_VALUES: AddCardFormValues = {
  collectionId: '',
  condition: '',
  language: 'fr',
  quantity: 1,
};

/** La collection fait partie de celles de l'utilisateur, dans la liste chargée en dernier. */
function isOwned(collections: readonly Collection[], id: string | null): id is string {
  return id !== null && collections.some((item) => item.id === id);
}

/**
 * Collection présélectionnée : celle de `?collection=<id>`, sinon la dernière utilisée, sinon la
 * plus récente (première de la liste) ; seulement si elle fait partie des collections de l'utilisateur.
 */
function preselectedCollection(
  collections: readonly Collection[],
  requested: string | null,
  lastUsed: string | null,
): string {
  if (isOwned(collections, requested)) {
    return requested;
  }
  if (isOwned(collections, lastUsed)) {
    return lastUsed;
  }
  return collections[0]?.id ?? '';
}

function cardName({ card }: CatalogCard): string {
  return card.nameFr ?? card.nameEn;
}

/**
 * Ajout manuel d'une carte (UC-11, WF-D14) : recherche dans le catalogue et formulaire au centre,
 * aperçu à droite (au-dessus sous le seuil desktop). Pendant l'envoi, la recherche et les champs
 * sont désactivés. Après un ajout réussi, la saisie en série reprend au champ de recherche,
 * collection, état et langue conservés.
 */
export function AddCardPage() {
  usePageTitle('Ajouter une carte');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const collectionsQuery = useCollections();
  const addCard = useAddCardEntry();
  const [lastUsedCollection] = useState(() => (user === null ? null : readLastCollection(user.id)));
  const [text, setText] = useState('');
  const search = useSearchCatalog(text);
  const [selected, setSelected] = useState<CatalogCard | null>(null);
  const [values, setValues] = useState<AddCardFormValues>(INITIAL_VALUES);
  const [addedCount, setAddedCount] = useState(0);
  const searchInput = useRef<HTMLInputElement>(null);
  /** Un ajout vient de réussir : le focus revient à la recherche dès qu'elle est réactivée. */
  const focusSearchAfterAdd = useRef(false);

  // Pendant l'envoi, la recherche est désactivée et ne peut pas recevoir le focus : il lui est
  // rendu une fois l'envoi terminé, que la fin de l'envoi ou le succès arrive en premier.
  useEffect(() => {
    if (!addCard.isPending && focusSearchAfterAdd.current) {
      focusSearchAfterAdd.current = false;
      searchInput.current?.focus();
    }
  }, [addCard.isPending, addedCount]);

  if (collectionsQuery.isPending) {
    return <DelayedLoadingLabel />;
  }

  if (collectionsQuery.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-space-16 p-space-24">
        <Text variant="body">Vos collections n’ont pas pu être chargées.</Text>
        <Button variant="secondary" onClick={() => void collectionsQuery.refetch()}>
          Réessayer
        </Button>
      </div>
    );
  }

  const collections = collectionsQuery.data;
  if (collections.length === 0) {
    return (
      <div className="flex flex-col items-center p-space-24">
        <EmptyState
          icon="list"
          title="Aucune collection pour l’instant"
          description="Créez une collection pour y ranger vos cartes."
        />
        <Link to={ROUTES.collections} className="underline decoration-acier-texte">
          <Text as="span" variant="body">
            Créer une collection
          </Text>
        </Link>
      </div>
    );
  }

  // La collection choisie est revérifiée contre la liste actuelle à chaque rendu : si elle en a
  // disparu (supprimée ailleurs, liste rechargée), la règle de présélection s'applique de nouveau.
  const formValues: AddCardFormValues = {
    ...values,
    collectionId: isOwned(collections, values.collectionId)
      ? values.collectionId
      : preselectedCollection(
          collections,
          searchParams.get(ADD_CARD_COLLECTION_PARAM),
          lastUsedCollection,
        ),
  };

  function selectCard(card: CatalogCard) {
    setSelected(card);
    setText(cardName(card));
  }

  /** Le texte saisi ne désigne plus la carte choisie : elle est annulée, rien ne s'enregistre par erreur. */
  function changeSearchText(nextText: string) {
    setText(nextText);
    setSelected(null);
  }

  function handleSubmit({ collectionId, condition, language, quantity }: AddCardFormSubmission) {
    const card = selected;
    const collection = collections.find((item) => item.id === collectionId);
    // Inatteignable depuis le formulaire : « Enregistrer » est désactivé sans carte, et une
    // collection absente de cette même liste est signalée sur son champ avant l'envoi.
    if (card === null || collection === undefined) {
      return;
    }
    addCard.mutate(
      {
        collectionId,
        entry: { cardId: card.card.id, quantity, condition, language },
        preview: { card: card.card, set: card.set, variant: null },
      },
      {
        onSuccess: () => {
          if (user !== null) {
            writeLastCollection(user.id, collectionId);
          }
          toast.success(`${cardName(card)} ajoutée à “${collection.name}”`, {
            label: 'Voir la collection',
            onAction: () => void navigate(collectionPath(collectionId)),
          });
          setAddedCount((count) => count + 1);
          // Saisie en série : collection, état et langue conservés, retour au champ de recherche.
          setSelected(null);
          setText('');
          setValues({ collectionId, condition, language, quantity: INITIAL_VALUES.quantity });
          focusSearchAfterAdd.current = true;
        },
        onError: (error) => {
          toast.error(translateAddCardError(error));
        },
      },
    );
  }

  return (
    <div className="flex flex-col items-center gap-space-24 p-space-24 desktop:flex-row desktop:items-start desktop:justify-center">
      <div className="flex w-full max-w-form flex-col gap-space-24">
        <div className="flex h-space-24 items-baseline justify-end" role="status">
          {addedCount > 0 && (
            <Text variant="data" color="acier-texte">
              {addedCount} {addedCount > 1 ? 'cartes ajoutées' : 'carte ajoutée'}
            </Text>
          )}
        </div>
        <CatalogSearch
          value={text}
          onValueChange={changeSearchText}
          search={search}
          onSelect={selectCard}
          inputRef={searchInput}
          autoFocus
          disabled={addCard.isPending}
        />
        <AddCardForm
          collections={collections}
          values={formValues}
          onChange={setValues}
          cardSelected={selected !== null}
          submitting={addCard.isPending}
          onSubmit={handleSubmit}
          onCancel={() => void navigate(-1)}
        />
      </div>
      <div className="order-first w-sidebar shrink-0 desktop:order-none">
        <CardPreviewPanel selected={selected} />
      </div>
    </div>
  );
}
