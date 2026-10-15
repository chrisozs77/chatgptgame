-- Run in the SQL Editor of your own Supabase project. No credentials belong here.
create table if not exists public.degen_ledger_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  result text not null check (result in ('gain', 'loss')),
  cents bigint not null check (cents between 1 and 999999999),
  note text not null default '' check (length(note) <= 80),
  created_at timestamptz not null,
  deleted boolean not null default false,
  primary key (user_id, id)
);

alter table public.degen_ledger_entries add column if not exists revision text not null default ''
  check (revision = '' or revision ~ '^[0-9]{13}-[0-9a-z]{16}$');

alter table public.degen_ledger_entries enable row level security;
revoke all on public.degen_ledger_entries from anon;
grant select, insert, update on public.degen_ledger_entries to authenticated;
revoke delete on public.degen_ledger_entries from authenticated;

drop policy if exists degen_read_own on public.degen_ledger_entries;
create policy degen_read_own on public.degen_ledger_entries for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists degen_insert_own on public.degen_ledger_entries;
create policy degen_insert_own on public.degen_ledger_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists degen_update_own on public.degen_ledger_entries;
create policy degen_update_own on public.degen_ledger_entries for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Versioned edits keep the same entry and its original session date.
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
drop trigger if exists degen_immutable_result on public.degen_ledger_entries;
create trigger degen_immutable_result before update on public.degen_ledger_entries
  for each row execute function public.degen_preserve_result();
