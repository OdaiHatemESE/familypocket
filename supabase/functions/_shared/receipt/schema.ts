// The receipt shape every AI provider returns, and the instructions for producing it.
// Used for photos (scan-receipt) and for purchases typed or spoken in the assistant.

export type CatalogItem = { id: string; name: string; unit: string; category_id: string; group_name?: string | null };
export type CatalogCategory = { id: string; name: string };
export type Catalog = { items: CatalogItem[]; categories: CatalogCategory[]; units: string[] };

/** A product, or a charge that changes what was paid (VAT on top, service, delivery, tip, other fee, order discount) */
export const LINE_KINDS = ['item', 'tax', 'service', 'delivery', 'tip', 'fee', 'discount'] as const;
export type LineKind = (typeof LINE_KINDS)[number] | 'adjust';

/** What the model returns, before the server validates it */
export type RawLine = {
  kind: LineKind;
  raw_text: string; // the line exactly as printed (or the words the user used)
  quantity: number;
  unit: string;
  line_total: number | null; // after any line discount; null when the user did not say a price
  name: string; // specific Arabic name (خبز أسمر); exactly a family item's name when it is that same product
  group: string; // general type (خبز), shared by every variant
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
    kind: { type: 'string', enum: [...LINE_KINDS] },
    raw_text: { type: 'string' },
    quantity: { type: 'number' },
    unit: { type: 'string' },
    line_total: { type: 'number', ...(priceOptional ? { nullable: true } : {}) },
    name: { type: 'string' },
    group: { type: 'string' },
    category_id: { type: 'string', nullable: true },
    uncertain: { type: 'boolean' },
  },
  required: ['kind', 'raw_text', 'quantity', 'unit', 'line_total', 'name', 'group', 'category_id', 'uncertain'],
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

/** How to turn one product or charge into a line: shared by photos and typed purchases */
export const lineRules = (units: string[]) => `- kind: "item" for a product. Every charge or discount that changes what was paid is a line of its own:
  "tax" = VAT added ON TOP of the prices; "service" = service charge; "delivery" = delivery fee; "tip" = tip;
  "fee" = any other fee (small order fee, packaging, bag charge, card or booking fee); "discount" = a discount or promo on
  the whole order, with a NEGATIVE line_total. A discount printed under one product is not a line: subtract it from that
  product. When the receipt says prices already include VAT ("VAT included", "incl. VAT", "شامل الضريبة"), there is no tax
  line. For a charge line: quantity 1, unit حبة, name in Arabic ("ضريبة القيمة المضافة", "رسوم الخدمة", "رسوم التوصيل",
  "بقشيش", the fee's own name, "خصم" or the promo's name), group the same as name, category_id null.
- quantity: the count or weight bought (e.g. 2, 1.25). Weighed items use their weight. Default to 1 when not given.
- unit: choose one of: ${units.join('، ')}. Count packaged products by the pack, not by the size printed in their name:
  "JUICE 1.75L" bought once is quantity 1, unit عبوة; "WATER 6x1.5L" is 1 كرتونة. Use كيلو or لتر only for products sold loose by weight or volume
  (e.g. "BANANA 1.120KG" is 1.12 كيلو). Tins and boxes → علبة. Bags → كيس. Bread → ربطة or رغيف. Otherwise → حبة.
- name: the product's own name in Arabic, as specific as the receipt: keep what makes it a different product
  (flavour, colour, type, cut): "خبز أسمر" and "خبز أبيض", "شوكولاتة بندق" and "شوكولاتة فانيلا" are different products.
  Leave out brands, sizes, weights and codes ("ALMARAI FULL FAT MILK 2L" → "حليب كامل الدسم").
  If one of the family items below is this same product (same variant), write exactly its name, so purchases add up.
  Never reuse the name of a different variant: a family item "خبز أبيض" is not "خبز أسمر".
- group: what the product IS, in one or two Arabic words, shared by all its variants and brands: "خبز" for خبز أسمر,
  "شوكولاتة" for شوكولاتة بندق, "حليب", "صدر دجاج", "طماطم". Not the aisle or category: "منظفات", "خضار", "لحوم",
  "ألبان" are too broad. When one of the family items below is the same kind of product (any variant or brand), use
  that item's type exactly as written, so they add up together: a family item "دواء جلي" (dishwashing liquid) makes
  every dishwashing liquid's type "دواء جلي". When the name has nothing more general, use the name itself.
- category_id: always one of the family category ids: the closest one, even if the match is loose. Food, drinks and
  cleaning supplies go to the household or groceries category when there is no closer one. Use null only for a line that is not a product.`;

export const catalogText = (c: Catalog) => `Family categories (id | name):
${c.categories.map((x) => `${x.id} | ${x.name}`).join('\n')}

Family items (name | type | unit | category_id):
${c.items.map((i) => `${i.name} | ${i.group_name || i.name} | ${i.unit} | ${i.category_id}`).join('\n') || '(none yet)'}`;

const SOURCES = {
  photo: 'Extract every purchased product line from the photo.',
  pages: 'The photos are consecutive parts of ONE long receipt, in order. Extract every purchased product line across all of them. Parts may overlap: a line that appears at the bottom of one photo and the top of the next is ONE line, so list it once. The total and date may be on any part.',
  pdf: 'The PDF is the receipt (it may have several pages). Extract every purchased product line across all pages.',
};

export function buildScanPrompt(c: Catalog, source: keyof typeof SOURCES = 'photo'): string {
  return `You read shopping receipts for a family budgeting app in the UAE. ${SOURCES[source]}

Rules:
- One entry per product line, plus one entry per charge or order discount (see kind). Skip subtotal, total, payment method,
  change, loyalty points, VAT summaries of prices that already include VAT, and header/footer lines.
- If a discount or promotion line applies to the product above it, subtract it from that product's line_total.
- The lines must add up to the total paid: check it before answering.
- raw_text: the product line exactly as printed.
${lineRules(c.units)}
- line_total: the amount paid for that line, as a number without currency.
- uncertain: true if the line is hard to read or you guessed part of it.
- date as YYYY-MM-DD. total is the final amount paid including VAT.
- Return only data visible on the receipt. If it is not a receipt, return empty lines and null fields.

${catalogText(c)}`;
}
