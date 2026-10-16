// A receipt-reading provider takes a photo plus the family's catalogue and returns raw extracted data.
// Every provider returns the same shape, so they can be swapped with one setting (RECEIPT_PROVIDER).

export type CatalogItem = { id: string; name: string; unit: string; category_id: string };
export type CatalogCategory = { id: string; name: string };

export type ScanInput = {
  imageBase64: string;
  mimeType: string;
  items: CatalogItem[];
  categories: CatalogCategory[];
  units: string[];
};

/** What the model returns, before the server validates it */
export type RawReceipt = {
  store: string | null;
  date: string | null; // YYYY-MM-DD
  total: number | null; // grand total actually paid
  lines: {
    raw_text: string; // the line exactly as printed
    quantity: number;
    unit: string;
    line_total: number; // after any line discount
    item_id: string | null; // an existing item, when confident
    suggested_name: string; // short Arabic name, used when item_id is null
    category_id: string | null;
    uncertain: boolean; // the model could not read this line clearly
  }[];
};

export type ProviderResult = { receipt: RawReceipt; model: string };

export interface ReceiptProvider {
  name: string;
  scan(input: ScanInput): Promise<ProviderResult>;
}

export class ProviderError extends Error {
  constructor(public code: 'NOT_CONFIGURED' | 'RATE_LIMITED' | 'UPSTREAM' | 'BAD_OUTPUT', message: string) {
    super(message);
  }
}

/** JSON schema of RawReceipt, shared by all providers */
export const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    store: { type: 'string', nullable: true, description: 'Shop name as printed, or null' },
    date: { type: 'string', nullable: true, description: 'Purchase date as YYYY-MM-DD, or null if not printed' },
    total: { type: 'number', nullable: true, description: 'Grand total paid including VAT, or null' },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          raw_text: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          line_total: { type: 'number' },
          item_id: { type: 'string', nullable: true },
          suggested_name: { type: 'string' },
          category_id: { type: 'string', nullable: true },
          uncertain: { type: 'boolean' },
        },
        required: ['raw_text', 'quantity', 'unit', 'line_total', 'item_id', 'suggested_name', 'category_id', 'uncertain'],
      },
    },
  },
  required: ['store', 'date', 'total', 'lines'],
} as const;

export function buildPrompt(input: ScanInput): string {
  const items = input.items.map((i) => `${i.id} | ${i.name} | ${i.unit} | ${i.category_id}`).join('\n') || '(none yet)';
  const cats = input.categories.map((c) => `${c.id} | ${c.name}`).join('\n');
  return `You read shopping receipts for a family budgeting app in the UAE. Extract every purchased product line from the photo.

Rules:
- One entry per product line. Skip subtotal, total, VAT/tax, payment, change, loyalty points, and header/footer lines.
- If a discount or promotion line applies to the product above it, subtract it from that product's line_total. Never output discounts as lines.
- quantity: the count or weight bought (e.g. 2, 1.25). Weighed items use their weight. Default to 1 when not shown.
- unit: choose one of: ${input.units.join('، ')}. Weighed food → كيلو. Bottles of liquid → عبوة or لتر. Bread → ربطة or رغيف.
- line_total: the amount paid for that line, as a number without currency.
- item_id: the id of the family's existing item that is clearly the same product (brand and size may differ). Otherwise null.
- suggested_name: a short, generic Arabic name a family would use (e.g. "FAIRY LEMON 750ML" → "دواء جلي", "CHICKEN BREAST" → "صدر دجاج"). Use the existing item's name when item_id is set.
- category_id: the best family category for the product, or null if none fits.
- uncertain: true if the line is hard to read or you guessed part of it.
- date as YYYY-MM-DD. total is the final amount paid including VAT.
- Return only data visible on the receipt. If the image is not a receipt, return empty lines and null fields.

Family categories (id | name):
${cats}

Family items (id | name | unit | category_id):
${items}`;
}
