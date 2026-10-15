export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const toKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
export const todayKey = () => toKey(new Date());
export const monthKey = (d: Date) => toKey(d).slice(0, 7);
export const daysInMonth = (year: number, month0: number) => new Date(year, month0 + 1, 0).getDate();

export const parseAmount = (txt: string): number => {
  const western = txt
    .replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
    .replace(/[٫,]/g, '.')
    .replace(/[^0-9.]/g, '');
  const n = parseFloat(western);
  return isFinite(n) ? n : NaN;
};

/** Plain amount for sentences, e.g. "1,250 درهم" */
export const fmt = (n: number) => `${Math.round(n).toLocaleString('en-US')} درهم`;
export const num = (n: number) => Math.round(n).toLocaleString('en-US');

export const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
export const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const AR_DAYS_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export const monthName = (ym: string) => AR_MONTHS[Number(ym.slice(5, 7)) - 1];
export const monthLabel = (ym: string) => `${monthName(ym)} ${ym.slice(0, 4)}`;

export const dayLabel = (key: string) => {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === todayKey()) return 'اليوم';
  if (key === toKey(y)) return 'أمس';
  const [yy, mm, dd] = key.split('-').map(Number);
  return `${AR_DAYS[new Date(yy, mm - 1, dd).getDay()]}، ${dd} ${AR_MONTHS[mm - 1]}`;
};

export const shortDay = (key: string) => {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === todayKey()) return { top: 'اليوم', bottom: String(Number(key.slice(8))) };
  if (key === toKey(y)) return { top: 'أمس', bottom: String(Number(key.slice(8))) };
  const [yy, mm, dd] = key.split('-').map(Number);
  return { top: AR_DAYS_SHORT[new Date(yy, mm - 1, dd).getDay()], bottom: String(dd) };
};

export const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
};

export const PALETTE = [
  '#2E5EAA', '#0F7B6C', '#C9822B', '#B23A58', '#6B4FA3',
  '#3B8EA5', '#8A6D3B', '#5C7F3A', '#D0613C', '#56606E',
];

export const ICONS = [
  'home-variant-outline', 'car-outline', 'school-outline', 'baby-face-outline', 'lightning-bolt-outline',
  'cart-outline', 'silverware-fork-knife', 'gas-station-outline', 'medical-bag', 'cellphone',
  'airplane', 'gift-outline', 'tshirt-crew-outline', 'credit-card-outline', 'mosque', 'package-variant-closed',
  'wifi', 'dumbbell', 'paw', 'hand-heart-outline',
];
