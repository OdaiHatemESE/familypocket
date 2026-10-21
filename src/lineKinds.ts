// Receipt lines that are not products: what each kind is called and shown with.
// Same kinds as the server (supabase/functions/_shared/receipt/schema.ts) and the expense_items.kind column.
import type { IconName } from './ui';

export type LineKind = 'item' | 'tax' | 'service' | 'delivery' | 'tip' | 'fee' | 'discount' | 'adjust';
export type ChargeKind = Exclude<LineKind, 'item'>;

export const CHARGES: { key: ChargeKind; label: string; icon: IconName }[] = [
  { key: 'tax', label: 'ضريبة القيمة المضافة', icon: 'percent-outline' },
  { key: 'service', label: 'رسوم الخدمة', icon: 'room-service-outline' },
  { key: 'delivery', label: 'رسوم التوصيل', icon: 'moped-outline' },
  { key: 'tip', label: 'بقشيش', icon: 'hand-coin-outline' },
  { key: 'fee', label: 'رسوم', icon: 'cash-plus' },
  { key: 'discount', label: 'خصم', icon: 'tag-outline' },
  { key: 'adjust', label: 'فرق عن مجموع الفاتورة', icon: 'scale-balance' },
];

/** Kinds a person can add by hand (a correction line only comes from reading a receipt) */
export const ADDABLE = CHARGES.filter((c) => c.key !== 'adjust');

export const chargeOf = (k: LineKind | undefined) => CHARGES.find((c) => c.key === k);
export const isCharge = (k: LineKind | undefined) => !!k && k !== 'item';

/** A discount is stored negative; every other charge positive */
export const signed = (k: LineKind, amount: number) => (k === 'discount' ? -Math.abs(amount) : k === 'adjust' ? amount : Math.abs(amount));
