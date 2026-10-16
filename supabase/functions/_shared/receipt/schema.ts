// The receipt shape every AI provider returns, and the instructions for producing it.
// Used for photos (scan-receipt) and for purchases typed or spoken in the assistant.

export type CatalogItem = { id: string; name: string; unit: string; category_id: string };
export type CatalogCategory = { id: string; name: string };
export type Catalog = { items: CatalogItem[]; categories: CatalogCategory[]; units: string[] };

/** What the model returns, before the server validates it */
export type RawLine = {
  raw_text: string; // the line exactly as printed (or the words the user used)
  quantity: number;
  unit: string;
  line_total: number | null; // after any line discount; null when the user did not say a price
  item_id: string | null; // an existing item, when it is the same kind of product
  suggested_name: string; // short Arabic name, used when item_id is null
  category_id: string | null;
  uncertain: boolean; // hard to read, or partly guessed
};

export type RawReceipt = {
  store: string | null;
  date: string | null; // YYYY-MM-DD
  total: number | null; // grand total actually paid
  lines: RawLine[];
};

const lineSchema = (priceOptional: boolean) => ({
  type: 'object',
  properties: {
    raw_text: { type: 'string' },
    quantity: { type: 'number' },
    unit: { type: 'string' },
    line_total: { type: 'number', ...(priceOptional ? { nullable: true } : {}) },
    item_id: { type: 'string', nullable: true },
    suggested_name: { type: 'string' },
    category_id: { type: 'string', nullable: true },
    uncertain: { type: 'boolean' },
  },
  required: ['raw_text', 'quantity', 'unit', 'line_total', 'item_id', 'suggested_name', 'category_id', 'uncertain'],
});

export const receiptSchema = (priceOptional = false) => ({
  type: 'object',
  properties: {
    store: { type: 'string', nullable: true, description: 'Shop name, or null' },
    date: { type: 'string', nullable: true, description: 'Purchase date as YYYY-MM-DD, or null if unknown' },
    total: { type: 'number', nullable: true, description: 'Grand total paid including VAT, or null' },
    lines: { type: 'array', items: lineSchema(priceOptional) },
  },
  required: ['store', 'date', 'total', 'lines'],
});

/** How to turn one product into a line: shared by photos and typed purchases */
export const lineRules = (units: string[]) => `- quantity: the count or weight bought (e.g. 2, 1.25). Weighed items use their weight. Default to 1 when not given.
- unit: choose one of: ${units.join('، ')}. Count packaged products by the pack, not by the size printed in their name:
  "JUICE 1.75L" bought once is quantity 1, unit عبوة; "WATER 6x1.5L" is 1 كرتونة. Use كيلو or لتر only for products sold loose by weight or volume
  (e.g. "BANANA 1.120KG" is 1.12 كيلو). Tins and boxes → علبة. Bags → كيس. Bread → ربطة or رغيف. Otherwise → حبة.
- item_id: before suggesting anything new, work out what kind of product each family item is, then look for the same kind.
  Family item names are often colloquial Levantine or Gulf Arabic: "دواء جلي" is dishwashing liquid, "دواء غسيل" is laundry detergent,
  "محارم" or "كلينكس" are tissues, "بندورة" and "طماطم" are both tomatoes. Use the family item's id when it is the same kind of
  product, even if the brand, size or wording differ (any brand of dishwashing liquid → their dishwashing item;
  any brand of eggs → their eggs item). Use null only when no family item is that kind of product.
- suggested_name: a short, generic Arabic name a family would use (e.g. "PERSIL GEL 3L" → "سائل غسيل", "LAMB CHOPS" → "ريش غنم"). Use the existing item's name when item_id is set.
- category_id: always one of the family category ids: the closest one, even if the match is loose. Food, drinks and
  cleaning supplies go to the household or groceries category when there is no closer one. Use null only for a line that is not a product.`;

export const catalogText = (c: Catalog) => `Family categories (id | name):
${c.categories.map((x) => `${x.id} | ${x.name}`).join('\n')}

Family items (id | name | unit | category_id):
${c.items.map((i) => `${i.id} | ${i.name} | ${i.unit} | ${i.category_id}`).join('\n') || '(none yet)'}`;

export function buildScanPrompt(c: Catalog): string {
  return `You read shopping receipts for a family budgeting app in the UAE. Extract every purchased product line from the photo.

Rules:
- One entry per product line. Skip subtotal, total, VAT/tax, payment, change, loyalty points, and header/footer lines.
- If a discount or promotion line applies to the product above it, subtract it from that product's line_total. Never output discounts as lines.
- raw_text: the product line exactly as printed.
${lineRules(c.units)}
- line_total: the amount paid for that line, as a number without currency.
- uncertain: true if the line is hard to read or you guessed part of it.
- date as YYYY-MM-DD. total is the final amount paid including VAT.
- Return only data visible on the receipt. If the image is not a receipt, return empty lines and null fields.

${catalogText(c)}`;
}
