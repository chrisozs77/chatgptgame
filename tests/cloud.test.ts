import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CloudLedger, CloudRecord, decodeAccount, Remote, Storage, visibleEntries, accountKey } from '../src/cloud/engine';
import { Entry } from '../src/ledger';
import { validateCloudConfig } from '../src/cloud/config';
import { cachedIdentity } from '../src/cloud/identity';

const entry = (id: string): Entry => ({ id, result: 'gain', cents: 10050, note: id, createdAt: '2026-10-14T18:00:00.000Z' });
function memory() {
  const values = new Map<string, string>();
  let fail = false;
  const store: Storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => {
    if (fail) throw new Error('Quota'); values.set(key, value);
  } };
  return { store, values, fail: (value: boolean) => { fail = value; } };
}
function server() {
  const records = new Map<string, CloudRecord>();
  let offline = false;
  const api: Remote = {
    push: async changes => { if (offline) throw new Error('Offline'); for (const change of changes) records.set(change.id, { ...change, deleted: change.deleted || !!records.get(change.id)?.deleted }); },
    pull: async () => { if (offline) throw new Error('Offline'); return [...records.values()].map(r => ({ ...r })); },
  };
  return { api, records, offline: (value: boolean) => { offline = value; } };
}

test('offline results survive a restart and upload after reconnecting', async () => {
  const disk = memory(), remote = server(); remote.offline(true);
  const ledger = new CloudLedger('alice', disk.store, remote.api); await ledger.load(); await ledger.add(entry('a'));
  await assert.rejects(ledger.sync());
  const restored = new CloudLedger('alice', disk.store, remote.api); await restored.load();
  assert.equal(visibleEntries(restored.snapshot()).length, 1); assert.deepEqual(restored.snapshot().pending, ['a']);
  remote.offline(false); await restored.sync();
  assert.equal(remote.records.get('a')?.cents, 10050); assert.deepEqual(restored.snapshot().pending, []);
});
test('a fresh device restores cloud history without replacing it with an empty ledger', async () => {
  const first = memory(), remote = server();
  const original = new CloudLedger('alice', first.store, remote.api); await original.load(); await original.add(entry('a')); await original.sync();
  const restored = new CloudLedger('alice', memory().store, remote.api); await restored.load(); await restored.sync();
  assert.deepEqual(visibleEntries(restored.snapshot()), [entry('a')]);
});
test('local caches and queues belong to their account, never another signed-in user', async () => {
  const disk = memory();
  const alice = new CloudLedger('alice', disk.store, server().api); await alice.load(); await alice.add(entry('private'));
  const bob = new CloudLedger('bob', disk.store, server().api); await bob.load();
  assert.deepEqual(visibleEntries(bob.snapshot()), []); assert.deepEqual(bob.snapshot().pending, []);
  assert.notEqual(accountKey('alice'), accountKey('bob'));
});
test('failed storage writes cannot change totals or erase pending changes', async () => {
  const disk = memory(), ledger = new CloudLedger('alice', disk.store, server().api);
  await ledger.load(); await ledger.add(entry('a')); const before = ledger.snapshot();
  disk.fail(true); await assert.rejects(ledger.add(entry('b'))); await assert.rejects(ledger.remove('a'));
  assert.deepEqual(ledger.snapshot(), before);
});
test('corrupt account storage is not overwritten', async () => {
  const disk = memory(); disk.values.set(accountKey('alice'), 'broken');
  const ledger = new CloudLedger('alice', disk.store, server().api);
  await assert.rejects(ledger.load()); await assert.rejects(ledger.add(entry('a')));
  assert.equal(disk.values.get(accountKey('alice')), 'broken');
});
test('a failed re-read blocks subsequent writes even if the account loaded earlier', async () => {
  const disk = memory(), ledger = new CloudLedger('alice', disk.store, server().api);
  await ledger.load(); await ledger.add(entry('a'));
  disk.values.set(accountKey('alice'), 'broken');
  await assert.rejects(ledger.load()); await assert.rejects(ledger.add(entry('b')));
  assert.equal(disk.values.get(accountKey('alice')), 'broken');
});
test('cache separation also includes the Supabase project', async () => {
  const disk = memory();
  const original = new CloudLedger('alice', disk.store, server().api, () => {}, 'https://one.supabase.co');
  await original.load(); await original.add(entry('private'));
  const other = new CloudLedger('alice', disk.store, server().api, () => {}, 'https://two.supabase.co');
  await other.load(); assert.deepEqual(visibleEntries(other.snapshot()), []);
});
test('deletions survive stale offline uploads from another device', async () => {
  const remote = server(), disk = memory();
  const first = new CloudLedger('alice', disk.store, remote.api); await first.load(); await first.add(entry('a')); await first.sync();
  const staleDisk = memory(); staleDisk.values.set(accountKey('alice'), JSON.stringify({ ...first.snapshot(), pending: ['a'] }));
  const stale = new CloudLedger('alice', staleDisk.store, remote.api); await stale.load();
  await first.remove('a'); await first.sync(); await stale.sync();
  assert.equal(remote.records.get('a')?.deleted, true); assert.deepEqual(visibleEntries(stale.snapshot()), []);
  await stale.importLocal([entry('a')]); await stale.sync(); assert.deepEqual(visibleEntries(stale.snapshot()), []);
});
test('local entry and deletion during an in-flight upload remain queued and eventually sync', async () => {
  const remote = server(), disk = memory();
  let announce!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { announce = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  let first = true;
  const api: Remote = { pull: remote.api.pull, push: async rows => {
    if (first) { first = false; announce(); await gate; } await remote.api.push(rows);
  } };
  const ledger = new CloudLedger('alice', disk.store, api); await ledger.load(); await ledger.add(entry('a'));
  const syncing = ledger.sync(); await started;
  await ledger.remove('a'); await ledger.add(entry('b')); release(); await syncing;
  assert.equal(remote.records.get('a')?.deleted, true); assert.equal(remote.records.get('b')?.cents, 10050);
  assert.deepEqual(ledger.snapshot().pending, []); assert.deepEqual(visibleEntries(ledger.snapshot()), [entry('b')]);
});
test('two ledger instances writing the same cache cannot overwrite each other’s queued results', async () => {
  const disk = memory(), remote = server();
  const one = new CloudLedger('alice', disk.store, remote.api), two = new CloudLedger('alice', disk.store, remote.api);
  await one.load(); await two.load(); await Promise.all([one.add(entry('a')), two.add(entry('b'))]);
  const restored = new CloudLedger('alice', disk.store, remote.api); await restored.load();
  assert.equal(restored.snapshot().records.length, 2); assert.deepEqual(new Set(restored.snapshot().pending), new Set(['a', 'b']));
});
test('an old account sync cannot overwrite newer local changes after switching away and back', async () => {
  const disk = memory(), remote = server();
  let announce!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { announce = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const api: Remote = { push: remote.api.push, pull: async () => { const rows = await remote.api.pull(); announce(); await gate; return rows; } };
  const old = new CloudLedger('alice', disk.store, api); await old.load(); await old.add(entry('a'));
  const syncing = old.sync(); await started; old.stopSync();
  const current = new CloudLedger('alice', disk.store, remote.api); await current.load(); await current.add(entry('b'));
  release(); await assert.rejects(syncing);
  const restored = new CloudLedger('alice', disk.store, remote.api); await restored.load();
  assert.ok(restored.snapshot().records.some(record => record.id === 'b')); assert.ok(restored.snapshot().pending.includes('b'));
});
test('local import is explicit, idempotent, and does not re-add a deleted cloud record', async () => {
  const remote = server(), ledger = new CloudLedger('alice', memory().store, remote.api); await ledger.load();
  assert.equal(remote.records.size, 0); await ledger.importLocal([entry('a')]); await ledger.importLocal([entry('a')]); await ledger.sync();
  assert.equal(remote.records.size, 1); await ledger.remove('a'); await ledger.sync(); await ledger.importLocal([entry('a')]); await ledger.sync();
  assert.equal(remote.records.get('a')?.deleted, true); assert.deepEqual(visibleEntries(ledger.snapshot()), []);
});
test('malformed cloud data cannot replace valid local records', async () => {
  const disk = memory(); const api: Remote = { push: async () => {}, pull: async () => [{ ...entry('bad'), deleted: false, cents: -1 }] };
  const ledger = new CloudLedger('alice', disk.store, api); await ledger.load(); await ledger.add(entry('a'));
  const before = ledger.snapshot(); await assert.rejects(ledger.sync()); assert.deepEqual(ledger.snapshot(), before);
  assert.throws(() => decodeAccount('{"version":1,"records":[],"pending":["missing"],"imported":false}'));
});
test('client configuration rejects privileged keys and incomplete or unsafe URLs', () => {
  const jwt = (role: string) => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
  assert.equal(validateCloudConfig(), null);
  assert.equal(validateCloudConfig('https://project.supabase.co', 'sb_publishable_test')?.url, 'https://project.supabase.co');
  assert.ok(validateCloudConfig('https://project.supabase.co', jwt('anon')));
  for (const key of ['sb_secret_test', jwt('service_role'), 'unknown']) assert.throws(() => validateCloudConfig('https://project.supabase.co', key));
  assert.throws(() => validateCloudConfig('http://project.supabase.co', 'sb_publishable_test'));
  assert.throws(() => validateCloudConfig('https://username:password@project.supabase.co', 'sb_publishable_test'));
  assert.throws(() => validateCloudConfig('https://project.supabase.co'));
});
test('expired sign-in metadata identifies only the local cache and never returns credentials', () => {
  const user = { id: '11111111-1111-4111-8111-111111111111', email: 'alice@example.test' };
  assert.deepEqual(cachedIdentity(JSON.stringify({ user, access_token: 'synthetic', refresh_token: 'synthetic', expires_at: 1 })), user);
  for (const raw of [null, 'broken', '{}', JSON.stringify({ user })]) assert.equal(cachedIdentity(raw), null);
});
