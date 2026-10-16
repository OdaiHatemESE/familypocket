// Shared by the server function and the app, so both normalise receipt text the same way. No imports.

/** Lower-case, collapse spaces, drop prices/codes at the edges so the same product matches across receipts */
export function normalizeAlias(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '') // Arabic diacritics
    .replace(/\d+[.,]\d{2}\s*$/g, '') // trailing price
    .replace(/^\s*\d{5,}\s*/g, '') // leading barcode / item code
    .replace(/[^\p{L}\p{N}%.\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}
