import { decodeLedger, Entry } from '../ledger';

export type CloudRecord = Entry & { deleted: boolean };
export type AccountLedger = { version: 1; records: CloudRecord[]; pending: string[]; imported: boolean };
export type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>;
  withLock?<T>(key: string, job: () => Promise<T>): Promise<T> };
export type Remote = { push(records: CloudRecord[]): Promise<void>; pull(): Promise<CloudRecord[]> };
export const accountKey = (userId: string, project = 'default') => `degen-tracker.account.${encodeURIComponent(project)}.${userId}.v1`;
export const emptyAccount = (): AccountLedger => ({ version: 1, records: [], pending: [], imported: false });
const localLocks = new Map<string, Promise<unknown>>();
function inProcessLock<T>(key: string, job: () => Promise<T>): Promise<T> {
  const task = (localLocks.get(key) ?? Promise.resolve()).then(job);
  const completed = task.then(() => {}, () => {});
  localLocks.set(key, completed);
  void completed.then(() => { if (localLocks.get(key) === completed) localLocks.delete(key); });
  return task;
}

export function validateRecords(raw: unknown): CloudRecord[] {
  if (!Array.isArray(raw)) throw new Error('Invalid cloud ledger');
  const entries = decodeLedger(JSON.stringify({ version: 1, entries: raw }));
  return entries.map((entry, i) => {
    if (typeof raw[i].deleted !== 'boolean') throw new Error('Invalid cloud record');
    return { ...entry, deleted: raw[i].deleted };
  });
}

export function decodeAccount(raw: string | null): AccountLedger {
  if (raw === null) return emptyAccount();
  const data = JSON.parse(raw);
  if (data.version !== 1 || typeof data.imported !== 'boolean' || !Array.isArray(data.pending)) throw new Error('Invalid account save');
  const records = validateRecords(data.records);
  const ids = new Set(records.map(record => record.id));
  if (new Set(data.pending).size !== data.pending.length || data.pending.some((id: unknown) => typeof id !== 'string' || !ids.has(id))) throw new Error('Invalid pending save');
  return { version: 1, records, pending: data.pending, imported: data.imported };
}

export function visibleEntries(state: AccountLedger): Entry[] {
  return state.records.filter(record => !record.deleted).map(({ deleted: _, ...entry }) => entry)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
}

// Only short local writes are serialized. Network requests never block offline entry.
export class CloudLedger {
  private state = emptyAccount();
  private loaded = false;
  private writes: Promise<unknown> = Promise.resolve();
  private syncing: Promise<void> | null = null;
  private syncActive = true;
  constructor(readonly userId: string, private storage: Storage, private remote: Remote,
    private changed: (state: AccountLedger) => void = () => {}, private project = 'default') {}

  private serial<T>(job: () => Promise<T>): Promise<T> {
    const key = accountKey(this.userId, this.project);
    const next = this.writes.then(() => this.storage.withLock ? this.storage.withLock(key, job) : inProcessLock(key, job));
    this.writes = next.catch(() => {});
    return next;
  }
  async load() {
    return this.serial(async () => {
      this.loaded = false;
      this.state = decodeAccount(await this.storage.getItem(accountKey(this.userId, this.project)));
      this.loaded = true; this.changed(this.state); return this.state;
    });
  }
  snapshot(): AccountLedger {
    return { ...this.state, records: this.state.records.map(r => ({ ...r })), pending: [...this.state.pending] };
  }
  stopSync() { this.syncActive = false; }
  private async refresh() {
    if (!this.loaded) throw new Error('Read the account save before changing it.');
    this.state = decodeAccount(await this.storage.getItem(accountKey(this.userId, this.project)));
  }
  private async persist(next: AccountLedger) {
    if (!this.loaded) throw new Error('Read the account save before changing it.');
    await this.storage.setItem(accountKey(this.userId, this.project), JSON.stringify(next));
    this.state = next; this.changed(next);
  }
  async add(entry: Entry) {
    return this.serial(async () => {
      await this.refresh();
      entry = decodeLedger(JSON.stringify({ version: 1, entries: [entry] }))[0];
      if (this.state.records.some(record => record.id === entry.id)) throw new Error('Duplicate result ID');
      await this.persist({ ...this.state, records: [...this.state.records, { ...entry, deleted: false }], pending: [...this.state.pending, entry.id] });
    });
  }
  async remove(id: string) {
    return this.serial(async () => {
      await this.refresh();
      if (!this.state.records.some(record => record.id === id)) throw new Error('Result not found');
      await this.persist({ ...this.state, records: this.state.records.map(record => record.id === id ? { ...record, deleted: true } : record), pending: [...new Set([...this.state.pending, id])] });
    });
  }
  async importLocal(entries: Entry[]) {
    return this.serial(async () => {
      await this.refresh();
      entries = decodeLedger(JSON.stringify({ version: 1, entries }));
      const known = new Set(this.state.records.map(record => record.id));
      const additions = entries.filter(entry => !known.has(entry.id));
      await this.persist({ ...this.state, imported: true,
        records: [...this.state.records, ...additions.map(entry => ({ ...entry, deleted: false }))],
        pending: [...new Set([...this.state.pending, ...additions.map(entry => entry.id)])] });
    });
  }
  sync(): Promise<void> {
    if (!this.syncActive) return Promise.reject(new Error('Account changed; sync stopped.'));
    if (this.syncing) return this.syncing;
    this.syncing = this.synchronize().finally(() => { this.syncing = null; });
    return this.syncing;
  }
  private async synchronize() {
    for (let pass = 0; pass < 3; pass++) {
      const snapshot = await this.serial(async () => {
        if (!this.syncActive) throw new Error('Account changed; sync stopped.');
        if (!this.loaded) throw new Error('Account not loaded');
        await this.refresh();
        return this.snapshot();
      });
      const batch = snapshot.records.filter(record => snapshot.pending.includes(record.id));
      if (batch.length) await this.remote.push(batch);
      if (!this.syncActive) throw new Error('Account changed; sync stopped.');
      const remote = validateRecords(await this.remote.pull());
      await this.serial(async () => {
        if (!this.syncActive) throw new Error('Account changed; sync stopped.');
        await this.refresh();
        const sent = new Map(batch.map(record => [record.id, record]));
        const server = new Map(remote.map(record => [record.id, record]));
        const merged = new Map(server);
        const pending = new Set(this.state.pending);
        for (const local of this.state.records) {
          const uploaded = sent.get(local.id);
          if (uploaded && uploaded.deleted === local.deleted) pending.delete(local.id);
          const cloud = server.get(local.id);
          // Results are immutable, and deletion always wins across devices.
          merged.set(local.id, cloud ? { ...cloud, deleted: cloud.deleted || local.deleted } : local);
          if (!cloud || (local.deleted && !cloud.deleted)) pending.add(local.id);
        }
        await this.persist({ ...this.state, records: [...merged.values()], pending: [...pending] });
      });
      if (this.state.pending.length === 0) return;
    }
  }
}
