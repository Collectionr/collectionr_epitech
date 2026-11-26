import { useToasts } from '@shared/hooks';
import { toastStore } from '@shared/stores';

import { Toast } from './Toast';

/** En bas à droite, au-dessus de la page ; largeur de lecture limitée. */
const VIEWPORT_CLASSES =
  'pointer-events-none fixed bottom-0 right-0 z-10 flex w-full max-w-form flex-col gap-space-8 p-space-16';

const dismiss = (id: number) => toastStore.getState().dismiss(id);

/**
 * Pile des notifications de l'application, montée une seule fois à sa racine : elle affiche celles
 * du store (`toast.success()`…), 3 au plus, les plus anciennes en haut.
 */
export function ToastProvider() {
  const toasts = useToasts();

  return (
    <section aria-label="Notifications" className={VIEWPORT_CLASSES}>
      {toasts.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <Toast toast={item} onDismiss={dismiss} />
        </div>
      ))}
    </section>
  );
}
