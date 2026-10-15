-- Run once in your existing Degen Tracker project. Safe to rerun; keeps all logs.
-- This adds edit versions and updates the existing sync guard. No rows are removed.
begin;
alter table public.degen_ledger_entries add column if not exists revision text not null default ''
  check (revision = '' or revision ~ '^[0-9]{13}-[0-9a-z]{16}$');

create or replace function public.degen_preserve_result()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.user_id is distinct from old.user_id or new.id is distinct from old.id
    or new.created_at is distinct from old.created_at then
    raise exception 'Entry identity and original date cannot be changed.' using errcode = '23514';
  end if;
  -- Older devices omit revision. Their stale values cannot undo a newer edit.
  if (new.revision collate "C") <= (old.revision collate "C") then
    new.result := old.result;
    new.cents := old.cents;
    new.note := old.note;
    new.revision := old.revision;
  end if;
  -- Removal wins even when an offline edit arrives later.
  new.deleted := old.deleted or new.deleted;
  return new;
end;
$$;
commit;
