// Control, format (zero-width, bidi overrides), line/paragraph separators and every code point that
// renders as nothing (Hangul fillers U+115F/U+1160/U+3164/U+FFA0...: Default_Ignorable_Code_Point),
// plus the blank braille pattern U+2800. Invisible characters let two texts look identical or a
// text look empty. A regular space is allowed.
const INVISIBLE_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}\u2800]/u;

// Emoji are built with characters that are invisible on their own: the variation selectors
// U+FE0E/U+FE0F (a red heart, a lightning bolt) and the zero width joiner U+200D (a family, a heart
// on fire). They are legitimate when they follow an emoji (or an emoji's own selector), so only
// those are set aside before the check. The same characters after a letter, a space, or on their
// own stay rejected.
const JOINERS_AFTER_EMOJI =
  /(?<=[\p{Extended_Pictographic}\p{Emoji_Modifier}\uFE0F])[\uFE0E\uFE0F\u200D]/gu;
// A keycap ("1\uFE0F⃣") is a digit, #, or * followed by U+FE0F then U+20E3.
const KEYCAP_SELECTOR = /(?<=[0-9#*])\uFE0F(?=⃣)/gu;

const ALLOWED_LINE_WHITESPACE = /[\n\r\t]/g;

function withoutEmojiJoiners(text: string): string {
  return text.replace(JOINERS_AFTER_EMOJI, '').replace(KEYCAP_SELECTOR, '');
}

export function hasInvisibleCharacters(text: string): boolean {
  return INVISIBLE_CHARACTERS.test(withoutEmojiJoiners(text));
}

/** Same as hasInvisibleCharacters, for free text where line breaks and tabs are legitimate. */
export function hasInvisibleCharactersInFreeText(text: string): boolean {
  return hasInvisibleCharacters(text.replace(ALLOWED_LINE_WHITESPACE, ''));
}

/**
 * Length as a person counts it: one emoji is one character, not the two UTF-16 units that
 * `String.length` reports. The limits in CollectionLimits.ts are in characters.
 */
export function characterCount(text: string): number {
  return [...text].length;
}
