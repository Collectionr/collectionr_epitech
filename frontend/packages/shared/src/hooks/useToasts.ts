import { useStore } from 'zustand';

import { toastStore } from '../stores/toastStore';
import type { ToastItem } from '../stores/toastStore';

/** Notifications visibles, les plus anciennes d'abord (lues par le ToastProvider de l'application). */
export function useToasts(): ToastItem[] {
  return useStore(toastStore, (state) => state.toasts);
}
