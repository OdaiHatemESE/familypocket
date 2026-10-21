-- Receipt lines that are not products: VAT added on top, service charge, delivery, tip, other fees, an order
-- discount, and a correction line when what was read does not add up to the receipt's total.
-- A discount is negative; a correction can go either way; everything else stays zero or more.
alter table public.expense_items add column if not exists kind text not null default 'item'
  check (kind in ('item', 'tax', 'service', 'delivery', 'tip', 'fee', 'discount', 'adjust'));

alter table public.expense_items drop constraint if exists expense_items_amount_check;
alter table public.expense_items add constraint expense_items_amount_check
  check (case kind when 'discount' then amount <= 0 when 'adjust' then true else amount >= 0 end);
