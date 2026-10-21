// Validates what a provider returned against the family's own data and tidies it into a review draft.
// Pure functions only, so they can be tested without a network.
import { normalizeAlias } from './alias.ts';
import { LINE_KINDS, type CatalogCategory, type CatalogItem, type LineKind, type RawReceipt } from './schema.ts';

export { normalizeAlias };

export type DraftLine = {
  kind: LineKind; // 'item' = a product; otherwise a charge, discount or correction (see schema.ts)
  raw: string;
  itemId: string | null;
  name: string;
  group: string; // general type (خبز for خبز أسمر)
  unit: string;
  categoryId: string | null;
  quantity: number;
  amount: number;
  isNew: boolean; // not one of the family's items yet
  uncertain: boolean;
  learned: boolean; // matched through a saved correction
  needsPrice: boolean; // a typed purchase without a price: amount is 0 until the user fills it in
};

export type Draft = {
  store: string | null;
  date: string | null;
  total: number | null;
  linesTotal: number;
  lines: DraftLine[];
  warnings: string[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Arabic name of a charge when the model gave none */
export const CHARGE_NAMES: Record<Exclude<LineKind, 'item'>, string> = {
  tax: 'ضريبة القيمة المضافة',
  service: 'رسوم الخدمة',
  delivery: 'رسوم التوصيل',
  tip: 'بقشيش',
  fee: 'رسوم',
  discount: 'خصم',
  adjust: 'فرق عن مجموع الفاتورة',
};
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && isFinite(parseFloat(v)) ? parseFloat(v) : NaN);

export function normalizeReceipt(
  raw: RawReceipt,
  items: CatalogItem[],
  categories: CatalogCategory[],
  units: string[],
  aliases: Record<string, string>, // normalised alias → item id
  today: string, // YYYY-MM-DD
  opts: { priceOptional?: boolean } = {},
): Draft {
  const itemById = new Map(items.map((i) => [i.id, i]));
  // Same name as one of the family's items (ignoring diacritics, spacing and the definite article)
  const key = (s: string) => normalizeAlias(s).replace(/(^|\s)ال/g, '$1');
  const itemByName = new Map(items.map((i) => [key(i.name), i]));
  const catIds = new Set(categories.map((c) => c.id));
  const warnings: string[] = [];

  const lines: DraftLine[] = [];
  for (const l of Array.isArray(raw?.lines) ? raw.lines : []) {
    const rawText = String(l?.raw_text ?? '').trim();
    const kind: LineKind = (LINE_KINDS as readonly string[]).includes(l?.kind) ? l.kind : 'item';
    let amount = num(l?.line_total);

    // Charges and discounts: no item, one of them, priced as read (a discount is always negative)
    if (kind !== 'item') {
      if (!isFinite(amount) || amount === 0) continue;
      amount = kind === 'discount' ? -Math.abs(amount) : Math.abs(amount);
      const name = (String(l?.name ?? '').trim() || CHARGE_NAMES[kind]).slice(0, 60);
      lines.push({
        kind, raw: rawText, itemId: null, name, group: name.slice(0, 40), unit: units[0], categoryId: null,
        quantity: 1, amount: round2(amount), isNew: false, uncertain: !!l?.uncertain, learned: false, needsPrice: false,
      });
      continue;
    }

    const needsPrice = !!opts.priceOptional && (!isFinite(amount) || amount <= 0);
    if (needsPrice) amount = 0;
    else if (!isFinite(amount) || amount < 0) continue;
    let quantity = num(l?.quantity);
    if (!isFinite(quantity) || quantity <= 0) quantity = 1;

    // A correction the family saved for this printed text wins; otherwise a family item only when it has the same
    // name (same product and variant). Different variants stay separate items and meet through their type.
    const learnedId = rawText ? aliases[normalizeAlias(rawText)] : undefined;
    const said = String(l?.name ?? '').trim().replace(/\s+/g, ' ');
    const item = (learnedId && itemById.get(learnedId)) || (said ? itemByName.get(key(said)) : undefined);

    const unit = item?.unit ?? (units.includes(l?.unit) ? l.unit : units[0]);
    const categoryId = item?.category_id ?? (l?.category_id && catIds.has(l.category_id) ? l.category_id : null);
    const name = (item?.name ?? said) || rawText || 'صنف';
    const group = (item ? item.group_name || item.name : String(l?.group ?? '').trim().replace(/\s+/g, ' ')) || name;

    lines.push({
      kind: 'item',
      raw: rawText,
      itemId: item?.id ?? null,
      name: name.slice(0, 60),
      group: group.slice(0, 40),
      unit,
      categoryId,
      quantity: Math.round(quantity * 1000) / 1000,
      amount: round2(amount),
      isNew: !item,
      uncertain: !!l?.uncertain || !categoryId || needsPrice,
      learned: !!learnedId && !!item,
      needsPrice,
    });
  }

  const products = lines.filter((l) => l.kind === 'item');
  const sum = (ls: DraftLine[]) => round2(ls.reduce((a, l) => a + l.amount, 0));

  // Charges count towards the receipt's main category: the one with the largest share of its products
  const byCat = new Map<string, number>();
  for (const l of products) if (l.categoryId) byCat.set(l.categoryId, (byCat.get(l.categoryId) ?? 0) + l.amount);
  const mainCat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  for (const l of lines) if (l.kind !== 'item') l.categoryId = mainCat;

  let total = num(raw?.total);
  if (!isFinite(total) || total <= 0) total = NaN;
  // "…and paid 60 for everything": when only one product has no price, it gets what is left of the total
  const unpricedLines = lines.filter((l) => l.needsPrice);
  if (unpricedLines.length === 1 && isFinite(total)) {
    const rest = round2(total - sum(lines));
    if (rest > 0) Object.assign(unpricedLines[0], { amount: rest, needsPrice: false, uncertain: !unpricedLines[0].categoryId });
  }

  // The lines must add up to what was paid. VAT read as a line on a receipt whose prices already include it is dropped;
  // any difference left becomes a line of its own to review, never spread silently over the products.
  if (isFinite(total) && lines.length && !lines.some((l) => l.needsPrice)) {
    const taxes = lines.filter((l) => l.kind === 'tax');
    if (Math.abs(total - sum(lines)) > 0.01 && taxes.length && Math.abs(total - (sum(lines) - sum(taxes))) <= 0.01) {
      for (const t of taxes) lines.splice(lines.indexOf(t), 1);
      warnings.push('الأسعار شاملة الضريبة، فما ضفنا سطر ضريبة.');
    }
    // VAT printed on the receipt but not read as a line, when it is exactly what is missing: it was added on top
    const vat = num(raw?.vat);
    if (!lines.some((l) => l.kind === 'tax') && isFinite(vat) && vat > 0 && Math.abs(total - sum(lines) - vat) <= 0.01) {
      lines.push({
        kind: 'tax', raw: '', itemId: null, name: CHARGE_NAMES.tax, group: CHARGE_NAMES.tax, unit: units[0],
        categoryId: mainCat, quantity: 1, amount: round2(vat), isNew: false, uncertain: false, learned: false, needsPrice: false,
      });
    }
    const gap = round2(total - sum(lines));
    if (Math.abs(gap) > 0.01) {
      lines.push({
        kind: 'adjust', raw: '', itemId: null, name: CHARGE_NAMES.adjust, group: CHARGE_NAMES.adjust, unit: units[0],
        categoryId: mainCat, quantity: 1, amount: gap, isNew: false, uncertain: true, learned: false, needsPrice: false,
      });
      warnings.push(`الأسطر ما طابقت مجموع الفاتورة بـ ${Math.abs(gap)} درهم، فضفنا سطر «${CHARGE_NAMES.adjust}». راجعوه قبل الحفظ.`);
    }
  }
  const linesTotal = sum(lines);

  let date = typeof raw?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null;
  if (date && (date > today || date < '2020-01-01')) date = null;

  const charges = lines.filter((l) => l.kind !== 'item' && l.kind !== 'adjust');
  if (charges.length) warnings.push(`ضفنا ${charges.map((l) => l.name).join('، ')} ${charges.length === 1 ? 'كسطر لحاله' : 'كأسطر لحالها'}.`);
  const unpriced = lines.filter((l) => l.needsPrice).map((l) => `«${l.name}»`);
  if (unpriced.length) warnings.push(`ما ذكرت سعر ${unpriced.join('، ')}. اضغط على السطر واكتب سعره قبل الحفظ.`);
  if (!products.length) warnings.push('ما قدرنا نقرأ أصناف من الصورة. جرّبوا صورة أوضح للفاتورة كاملة.');
  const unsure = lines.filter((l) => l.uncertain && !l.needsPrice && l.kind !== 'adjust').length;
  if (unsure) warnings.push(unsure === 1 ? 'في سطر واحد محتاج مراجعة.' : `في ${unsure} أسطر محتاجة مراجعة.`);

  return {
    store: typeof raw?.store === 'string' && raw.store.trim() ? raw.store.trim().slice(0, 60) : null,
    date,
    total: isFinite(total) ? round2(total) : null,
    linesTotal,
    lines,
    warnings,
  };
}
