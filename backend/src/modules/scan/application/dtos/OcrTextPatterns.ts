// Text that comes from the worker ends up in logs and in catalogue queries: no control or
// invisible character (Unicode category C), and a text field cannot start with a space.
export const OCR_TEXT_PATTERN = /^[^\p{C}\s][^\p{C}]*$/u;

/** Free-form messages may contain spaces anywhere, but still no control or invisible character. */
export const OCR_MESSAGE_PATTERN = /^[^\p{C}]+$/u;
