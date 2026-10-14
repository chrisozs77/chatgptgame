import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const alice = '11111111-1111-4111-8111-111111111111', bob = '22222222-2222-4222-8222-222222222222';
let db: PGlite;
const schema = new URL('../supabase/schema.sql', import.meta.url);
before(async () => {
  db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated, anon;
    insert into auth.users values ('${alice}'), ('${bob}');`);
  await db.exec(await readFile(schema, 'utf8'));
});
after(async () => { await db?.close(); });
async function asUser(id: string, sql: string, params: unknown[] = []) {
  return db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id]);
    return tx.query(sql, params);
  });
}
test('authenticated owners can insert and read their results', async () => {
  await asUser(alice, "insert into public.degen_ledger_entries(user_id,id,result,cents,note,created_at) values($1,'a','gain',10050,'Alice','2026-10-14T18:00:00Z')", [alice]);
  const result = await asUser(alice, 'select id from public.degen_ledger_entries');
  assert.deepEqual(result.rows, [{ id: 'a' }]);
});
test('another authenticated user cannot read, insert, or update the owner’s records', async () => {
  assert.deepEqual((await asUser(bob, 'select id from public.degen_ledger_entries')).rows, []);
  await assert.rejects(asUser(bob, "insert into public.degen_ledger_entries(user_id,id,result,cents,created_at) values($1,'forged','gain',100,'2026-10-14T18:00:00Z')", [alice]));
  const update = await asUser(bob, "update public.degen_ledger_entries set deleted=true where id='a' returning id");
  assert.deepEqual(update.rows, []);
});
test('anonymous clients cannot read the ledger', async () => {
  await assert.rejects(db.transaction(async tx => { await tx.exec('set local role anon'); return tx.query('select * from public.degen_ledger_entries'); }));
});
test('database deletion wins over a stale upsert and existing details cannot be changed', async () => {
  await asUser(alice, "update public.degen_ledger_entries set deleted=true where id='a'");
  await asUser(alice, "insert into public.degen_ledger_entries(user_id,id,result,cents,note,created_at,deleted) values($1,'a','gain',10050,'Alice','2026-10-14T18:00:00Z',false) on conflict(user_id,id) do update set deleted=excluded.deleted", [alice]);
  assert.deepEqual((await asUser(alice, "select deleted from public.degen_ledger_entries where id='a'")).rows, [{ deleted: true }]);
  await assert.rejects(asUser(alice, "update public.degen_ledger_entries set cents=1 where id='a'"));
});
test('schema setup is repeatable and preserves existing records', async () => {
  await db.exec(await readFile(schema, 'utf8'));
  assert.deepEqual((await asUser(alice, "select id,deleted from public.degen_ledger_entries where id='a'")).rows, [{ id: 'a', deleted: true }]);
});
