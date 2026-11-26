import { afterEach, describe, expect, it, vi } from 'vitest';

import { MAX_VISIBLE_TOASTS, toast, toastStore } from './toastStore';

const messages = () => toastStore.getState().toasts.map(({ message }) => message);

afterEach(() => {
  toastStore.getState().clear();
});

describe('toastStore', () => {
  it('affiche des notifications de chaque sévérité, appelables hors composant', () => {
    toast.success('Carte ajoutée');
    toast.info('Synchronisation en cours');
    toast.error('Ajout impossible');

    expect(toastStore.getState().toasts.map(({ severity }) => severity)).toEqual([
      'success',
      'info',
      'error',
    ]);
  });

  it('donne un identifiant unique à chaque notification', () => {
    const first = toast.success('Une');
    const second = toast.success('Deux');

    expect(first).not.toBe(second);
  });

  it('garde 3 notifications au plus, les plus anciennes sortant en premier', () => {
    for (const message of ['Une', 'Deux', 'Trois', 'Quatre']) {
      toast.info(message);
    }

    expect(MAX_VISIBLE_TOASTS).toBe(3);
    expect(messages()).toEqual(['Deux', 'Trois', 'Quatre']);
  });

  it('garde l’action proposée', () => {
    const onAction = vi.fn();
    toast.success('Dracaufeu ajoutée', { label: 'Voir la collection', onAction });

    expect(toastStore.getState().toasts[0]?.action).toEqual({
      label: 'Voir la collection',
      onAction,
    });
  });

  it('ferme une notification par son identifiant', () => {
    const id = toast.error('Ajout impossible');
    toast.success('Carte ajoutée');

    toast.dismiss(id);

    expect(messages()).toEqual(['Carte ajoutée']);
  });
});
