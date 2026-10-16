-- The usage log now covers the in-app assistant too, each with its own daily limit
alter table public.receipt_scans
  add column kind text not null default 'photo' check (kind in ('photo', 'assistant'));
create index receipt_scans_household_kind_time on public.receipt_scans (household_id, kind, created_at desc);
