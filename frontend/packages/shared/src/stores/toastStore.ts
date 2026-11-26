import { createStore } from 'zustand/vanilla';

/** Sévérité d'une notification ; portée par un glyphe et le texte, jamais par la couleur seule. */
export type ToastSeverity = 'success' | 'info' | 'error';

/** Action proposée dans une notification (« Voir la collection »). */
export interface ToastAction {
  /** Intitulé du bouton. */
  label: string;
  /** Appelée au clic ; la notification se ferme ensuite. */
  onAction: () => void;
}

/** Notification affichée. */
export interface ToastItem {
  /** Identifiant, unique pour la durée de l'application. */
  id: number;
  /** Sévérité. */
  severity: ToastSeverity;
  /** Message, en français. */
  message: string;
  /** Action facultative. */
  action?: ToastAction;
}

/** Notifications visibles au plus : au-delà, les plus anciennes sortent en premier. */
export const MAX_VISIBLE_TOASTS = 3;

/** Durée d'affichage d'un succès ou d'une information ; une erreur reste jusqu'à fermeture. */
export const TOAST_DURATION_MS = 4000;

/** État des notifications. */
export interface ToastState {
  /** Notifications visibles, les plus anciennes d'abord. */
  toasts: ToastItem[];
  /**
   * Affiche une notification.
   * @returns Son identifiant
   */
  show: (severity: ToastSeverity, message: string, action?: ToastAction) => number;
  /** Ferme une notification. */
  dismiss: (id: number) => void;
  /** Ferme toutes les notifications. */
  clear: () => void;
}

let lastId = 0;

/**
 * Notifications de l'application : un seul store, appelable hors composant (dans une mutation),
 * affiché par le ToastProvider de chaque application.
 */
export const toastStore = createStore<ToastState>((set) => ({
  toasts: [],
  show: (severity, message, action) => {
    lastId += 1;
    const id = lastId;
    set(({ toasts }) => ({
      toasts: [...toasts, { id, severity, message, action }].slice(-MAX_VISIBLE_TOASTS),
    }));
    return id;
  },
  dismiss: (id) => set(({ toasts }) => ({ toasts: toasts.filter((item) => item.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** API des notifications, appelable partout : `toast.success('Carte ajoutée')`. */
export const toast = {
  /** Succès, fermé après 4 s. */
  success: (message: string, action?: ToastAction) =>
    toastStore.getState().show('success', message, action),
  /** Information, fermée après 4 s. */
  info: (message: string, action?: ToastAction) =>
    toastStore.getState().show('info', message, action),
  /** Erreur, affichée jusqu'à sa fermeture. */
  error: (message: string, action?: ToastAction) =>
    toastStore.getState().show('error', message, action),
  /** Ferme une notification. */
  dismiss: (id: number) => toastStore.getState().dismiss(id),
};
