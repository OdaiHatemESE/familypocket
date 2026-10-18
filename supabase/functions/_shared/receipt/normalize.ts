// Validates what a provider returned against the family's own data and tidies it into a review draft.
// Pure functions only, so they can be tested without a network.
import { normalizeAlias } from './alias.ts';
import type { CatalogCategory, CatalogItem, RawReceipt } from './schema.ts';

export { normalizeAlias };

export type DraftLine = {
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
    let amount = num(l?.line_total);
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

  let total = num(raw?.total);
  if (!isFinite(total) || total <= 0) total = NaN;
  // "…and paid 60 for everything": when only one line has no price, it gets what is left of the total
  const unpricedLines = lines.filter((l) => l.needsPrice);
  if (unpricedLines.length === 1 && isFinite(total)) {
    const rest = round2(total - lines.reduce((a, l) => a + l.amount, 0));
    if (rest > 0) Object.assign(unpricedLines[0], { amount: rest, needsPrice: false, uncertain: !unpricedLines[0].categoryId });
  }
  let linesTotal = round2(lines.reduce((a, l) => a + l.amount, 0));

  // Receipts in the UAE often list prices before 5% VAT. When the gap is small, spread it across the lines
  // so the receipt adds up to what was actually paid.
  if (isFinite(total) && linesTotal > 0 && Math.abs(total - linesTotal) > 0.01 && !lines.some((l) => l.needsPrice)) {
    const gap = total - linesTotal;
    if (Math.abs(gap) / linesTotal <= 0.08) {
      let assigned = 0;
      lines.forEach((l, i) => {
        if (i === lines.length - 1) l.amount = round2(l.amount + (gap - assigned));
        else {
          const share = round2((l.amount / linesTotal) * gap);
          l.amount = round2(l.amount + share);
          assigned = round2(assigned + share);
        }
      });
      warnings.push(gap > 0 ? `وزّعنا الضريبة (${round2(gap)} درهم) على الأصناف حتى يطابق المجموع الفاتورة.` : `وزّعنا الخصم (${round2(-gap)} درهم) على الأصناف حتى يطابق المجموع الفاتورة.`);
      linesTotal = round2(total);
    } else {
      warnings.push(`مجموع الأصناف ${linesTotal} درهم والفاتورة ${round2(total)} درهم. راجعوا الأسطر قبل الحفظ.`);
    }
  }

  let date = typeof raw?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null;
  if (date && (date > today || date < '2020-01-01')) date = null;

  const unpriced = lines.filter((l) => l.needsPrice).map((l) => `«${l.name}»`);
  if (unpriced.length) warnings.push(`ما ذكرت سعر ${unpriced.join('، ')}. اضغط على السطر واكتب سعره قبل الحفظ.`);
  if (!lines.length) warnings.push('ما قدرنا نقرأ أصناف من الصورة. جرّبوا صورة أوضح للفاتورة كاملة.');
  const unsure = lines.filter((l) => l.uncertain && !l.needsPrice).length;
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
