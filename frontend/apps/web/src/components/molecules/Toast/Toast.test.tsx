import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { toast, TOAST_DURATION_MS, toastStore } from '@shared/stores';
import type { ToastItem } from '@shared/stores';
import { motion } from '@shared/tokens';

import { Toast } from './Toast';
import { ToastProvider } from './ToastProvider';

const SUCCESS: ToastItem = { id: 1, severity: 'success', message: 'Dracaufeu ajoutée' };
const ERROR: ToastItem = { id: 2, severity: 'error', message: 'Ajout impossible' };

/** Avance le temps ; une sortie programme son minuteur au rendu suivant, d'où une avancée à part. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function renderToast(item: ToastItem) {
  const onDismiss = vi.fn();
  render(<Toast toast={item} onDismiss={onDismiss} />);
  return {
    onDismiss,
    notification: screen.getByRole(item.severity === 'error' ? 'alert' : 'status'),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  toastStore.getState().clear();
});

describe('Toast', () => {
  it('annonce un succès avec un glyphe et sa sévérité lue, sans vert', () => {
    const { notification } = renderToast(SUCCESS);

    expect(notification.textContent).toContain('Succès : Dracaufeu ajoutée');
    const glyph = notification.querySelector('[aria-hidden="true"]');
    expect(glyph?.textContent).toBe('✓');
    expect(glyph?.innerHTML).toContain('text-archive');
    expect(notification.innerHTML).not.toMatch(/green|vert/);
  });

  it('annonce une erreur en alerte, glyphe en Alerte', () => {
    const { notification } = renderToast(ERROR);

    expect(notification.textContent).toContain('Erreur : Ajout impossible');
    expect(notification.querySelector('[aria-hidden="true"]')?.innerHTML).toContain('text-alerte');
  });

  it('pose un fond ecrin-elevated bordé d’un liséré, sans arrondi', () => {
    const { notification } = renderToast(SUCCESS);

    for (const name of ['bg-ecrin-elevated', 'border-lisere', 'rounded-none']) {
      expect(notification.classList.contains(name)).toBe(true);
    }
  });

  it('entre en glissant de 8 px avec un fondu, puis se pose', () => {
    const { notification } = renderToast(SUCCESS);
    expect(notification.className).toContain('translate-y-space-8 opacity-0 duration-snap');

    advance(16);

    expect(notification.className).toContain('translate-y-0 opacity-100');
  });

  it('se ferme seule après 4 s, en sortant en duration-instant', () => {
    const { onDismiss, notification } = renderToast(SUCCESS);

    advance(3999);
    expect(notification.className).not.toContain('duration-instant');
    advance(1);
    expect(notification.className).toContain('opacity-0 duration-instant');
    advance(motion.duration.instant);

    expect(onDismiss).toHaveBeenCalledWith(1);
  });

  it('garde une erreur affichée jusqu’à sa fermeture', () => {
    const { onDismiss } = renderToast(ERROR);

    advance(60_000);
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la notification' }));
    advance(motion.duration.instant);

    expect(onDismiss).toHaveBeenCalledWith(2);
  });

  it('met le minuteur en pause au survol, puis reprend le temps restant', () => {
    const { onDismiss, notification } = renderToast(SUCCESS);

    advance(3000);
    fireEvent.mouseEnter(notification);
    advance(10_000);
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.mouseLeave(notification);
    advance(999);
    expect(notification.className).not.toContain('duration-instant');
    advance(1);
    advance(motion.duration.instant);

    expect(onDismiss).toHaveBeenCalledWith(1);
  });

  it('met le minuteur en pause tant que le focus clavier est dans la notification', () => {
    const { onDismiss } = renderToast(SUCCESS);
    const close = screen.getByRole('button', { name: 'Fermer la notification' });

    act(() => close.focus());
    advance(10_000);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => close.blur());
    advance(TOAST_DURATION_MS);
    advance(motion.duration.instant);

    expect(onDismiss).toHaveBeenCalledWith(1);
  });

  it('lance l’action proposée puis se ferme', () => {
    const onAction = vi.fn();
    const { onDismiss } = renderToast({
      ...SUCCESS,
      action: { label: 'Voir la collection', onAction },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Voir la collection' }));
    advance(motion.duration.instant);

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith(1);
  });
});

describe('ToastProvider', () => {
  it('affiche les notifications du store en bas à droite, 3 au plus', () => {
    render(<ToastProvider />);

    act(() => {
      for (const message of ['Une', 'Deux', 'Trois', 'Quatre']) {
        toast.info(message);
      }
    });

    const region = screen.getByRole('region', { name: 'Notifications' });
    expect(region.className).toContain('fixed bottom-0 right-0');
    expect(screen.getAllByRole('status').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Deux'),
      expect.stringContaining('Trois'),
      expect.stringContaining('Quatre'),
    ]);
  });

  it('retire du store une notification fermée', () => {
    render(<ToastProvider />);
    act(() => {
      toast.error('Ajout impossible');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Fermer la notification' }));
    advance(motion.duration.instant);

    expect(toastStore.getState().toasts).toEqual([]);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
