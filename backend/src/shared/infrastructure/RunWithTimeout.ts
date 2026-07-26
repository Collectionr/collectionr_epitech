/**
 * Exécute une promesse avec un délai maximal. Le timer est toujours nettoyé
 * pour ne pas laisser de handle ouvert (important pour Jest et l'arrêt propre).
 */
export async function runWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} : délai de ${timeoutMs} ms dépassé`)),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
