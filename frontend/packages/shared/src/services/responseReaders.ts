/**
 * Lecture des corps de réponse non validés (`unknown`) renvoyés par `apiClient` : chaque service
 * vérifie la forme d'une réponse avant de la renvoyer typée.
 */

/** Champs lus, tous présents et du bon type. */
type RequiredFields<T> = { [K in keyof T]: Exclude<T[K], undefined> };

/**
 * Erreur levée quand une réponse 2xx n'a pas la forme attendue : contrat de l'API rompu.
 * @param path - Chemin de l'endpoint, cité dans le message
 */
export function unexpectedResponse(path: string): TypeError {
  return new TypeError(`Réponse inattendue de ${path}`);
}

/** Lit un champ d'une réponse non validée, sans en supposer le type. */
export function readField(value: unknown, field: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, field) : undefined;
}

/** Texte, ou `undefined` si le champ manque ou n'est pas un texte. */
export function readString(value: unknown, field: string): string | undefined {
  const fieldValue = readField(value, field);
  return typeof fieldValue === 'string' ? fieldValue : undefined;
}

/** Texte ou `null`, ou `undefined` si le champ manque ou n'a aucun de ces types. */
export function readNullableString(value: unknown, field: string): string | null | undefined {
  const fieldValue = readField(value, field);
  return fieldValue === null || typeof fieldValue === 'string' ? fieldValue : undefined;
}

/** Nombre fini, ou `undefined` si le champ manque ou n'en est pas un. */
export function readNumber(value: unknown, field: string): number | undefined {
  const fieldValue = readField(value, field);
  return typeof fieldValue === 'number' && Number.isFinite(fieldValue) ? fieldValue : undefined;
}

/** Nombre fini ou `null`, ou `undefined` si le champ manque ou n'a aucun de ces types. */
export function readNullableNumber(value: unknown, field: string): number | null | undefined {
  return readField(value, field) === null ? null : readNumber(value, field);
}

/** Liste de textes, ou `undefined` si le champ manque ou contient autre chose. */
export function readStringArray(value: unknown, field: string): string[] | undefined {
  const fieldValue = readField(value, field);
  return Array.isArray(fieldValue) && fieldValue.every((item) => typeof item === 'string')
    ? fieldValue
    : undefined;
}

/** Valeur parmi celles autorisées, ou `undefined` si le champ en a une autre. */
export function readOneOf<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T | undefined {
  const fieldValue = readField(value, field);
  return allowed.find((candidate) => candidate === fieldValue);
}

/**
 * Vérifie qu'aucun champ lu ne manque.
 * @param fields - Champs lus par les fonctions `read…` ; `undefined` signale un champ absent ou invalide
 * @param path - Chemin de l'endpoint, cité dans l'erreur
 * @returns Les mêmes champs, typés sans `undefined`
 * @throws {TypeError} Si un champ manque ou n'a pas le type attendu
 */
export function requireFields<T extends Record<string, unknown>>(
  fields: T,
  path: string,
): RequiredFields<T> {
  if (Object.values(fields).some((fieldValue) => fieldValue === undefined)) {
    throw unexpectedResponse(path);
  }
  // Vérifié juste au-dessus : aucun champ ne vaut `undefined`.
  return fields as RequiredFields<T>;
}
