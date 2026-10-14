import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decodeLedger, encodeLedger, Entry, STORAGE_KEY } from '../ledger';
import { AUTH_STORAGE_KEY, cloud, cloudProjectUrl, remoteForUser } from './client';
import { AccountLedger, CloudLedger, Storage, visibleEntries } from './engine';
import { AccountIdentity, cachedIdentity } from './identity';

export function useCloudAuth() {
  const [account, setAccount] = useState<AccountIdentity | null>(null);
  const [ready, setReady] = useState(!cloud);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!cloud) return;
    let active = true;
    let epoch = 0;
    const { data: listener } = cloud.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (next) { epoch++; setAccount({ id: next.user.id, email: next.user.email }); setReady(true); setError(''); }
      else if (event === 'SIGNED_OUT') { epoch++; setAccount(null); setReady(true); setError(''); }
    });
    void (async () => {
      const capturedEpoch = epoch;
      // Read the local identity before a network refresh, so expired tokens
      // do not hide the cached ledger when reopening the app offline.
      const cached = cachedIdentity(await AsyncStorage.getItem(AUTH_STORAGE_KEY));
      if (active && epoch === capturedEpoch && cached) { setAccount(cached); setReady(true); }
      const { data, error: problem } = await cloud.auth.getSession();
      if (!active || epoch !== capturedEpoch) return;
      if (data.session) { setAccount({ id: data.session.user.id, email: data.session.user.email }); setError(''); }
      else {
        const retained = cachedIdentity(await AsyncStorage.getItem(AUTH_STORAGE_KEY));
        if (!active || epoch !== capturedEpoch) return;
        setAccount(retained);
        if (problem && retained) setError('Your account is available offline. Reconnect to resume cloud sync.');
        else if (problem) setError('Could not restore your sign-in. Sign in again to reconnect.');
      }
      setReady(true);
    })().catch(() => { if (active) { setReady(true); setError('Could not restore your sign-in. Please reconnect.'); } });
    const appState = Platform.OS !== 'web' ? AppState.addEventListener('change', state => {
      if (state === 'active') cloud?.auth.startAutoRefresh(); else cloud?.auth.stopAutoRefresh();
    }) : null;
    if (Platform.OS !== 'web' && AppState.currentState === 'active') cloud.auth.startAutoRefresh();
    return () => { active = false; listener.subscription.unsubscribe(); appState?.remove(); if (Platform.OS !== 'web') cloud?.auth.stopAutoRefresh(); };
  }, []);
  return { account, ready, error, configured: !!cloud };
}

type SyncStatus = 'local' | 'pending' | 'syncing' | 'synced' | 'error';
type ViewState = { scope: string; entries: Entry[]; loaded: boolean; loadError: boolean; busy: boolean;
  pending: number; guestCount: number; sync: SyncStatus; syncError: string; saveError: string };
const initial = (scope: string): ViewState => ({ scope, entries: [], loaded: false, loadError: false, busy: false,
  pending: 0, guestCount: 0, sync: scope === 'guest' ? 'local' : 'pending', syncError: '', saveError: '' });
const ledgerStorage: Storage = typeof navigator !== 'undefined' && navigator.locks ? {
  getItem: key => AsyncStorage.getItem(key), setItem: (key, value) => AsyncStorage.setItem(key, value),
  withLock: (key, job) => navigator.locks.request(key, job),
} : AsyncStorage;

export function useDeviceLedger(account: AccountIdentity | null, authReady: boolean) {
  const scope = account?.id ?? 'guest';
  const [view, setView] = useState(() => initial(scope));
  const [reload, setReload] = useState(0);
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const engine = useRef<CloudLedger | null>(null);
  const guest = useRef<Entry[]>([]);
  const writeLock = useRef(false);
  const current = view.scope === scope && authReady ? view : initial(scope);

  const syncNow = useCallback(async () => {
    const runner = engine.current;
    if (!runner || runner.userId !== scope) return;
    setView(previous => previous.scope === scope ? { ...previous, sync: 'syncing', syncError: '' } : previous);
    try {
      await runner.sync();
      if (activeScope.current === scope && engine.current === runner) setView(previous => ({ ...previous,
        sync: runner.snapshot().pending.length ? 'pending' : 'synced', syncError: '' }));
    } catch {
      if (activeScope.current === scope && engine.current === runner) setView(previous => ({ ...previous, sync: 'error',
        syncError: 'Cloud sync paused. Only records cached on this device are shown. Reconnect and tap Sync now.' }));
    }
  }, [scope]);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let appListener: ReturnType<typeof AppState.addEventListener> | undefined;
    let localRunner: CloudLedger | null = null;
    const onReturn = () => { if (!cancelled) void syncNow(); };
    guest.current = []; engine.current = null;
    setView(initial(scope));
    const stillCurrent = () => !cancelled && activeScope.current === scope;
    const publish = (state: AccountLedger) => {
      if (!stillCurrent()) return;
      const known = new Set(state.records.map(record => record.id));
      setView(previous => ({ ...previous, scope, entries: visibleEntries(state), pending: state.pending.length,
        guestCount: guest.current.filter(entry => !known.has(entry.id)).length,
        sync: state.pending.length && previous.sync !== 'syncing' ? 'pending' : previous.sync }));
    };
    void (async () => {
      try {
        if (scope === 'guest' || !cloud) {
          const records = decodeLedger(await AsyncStorage.getItem(STORAGE_KEY));
          if (stillCurrent()) { guest.current = records; setView({ ...initial(scope), entries: records, loaded: true }); }
        } else {
          const runner = new CloudLedger(scope, ledgerStorage, remoteForUser(cloud, scope), publish, cloudProjectUrl);
          localRunner = runner;
          engine.current = runner;
          await runner.load();
          try {
            const records = decodeLedger(await AsyncStorage.getItem(STORAGE_KEY));
            if (stillCurrent()) guest.current = records;
          } catch { /* A damaged guest save never overwrites an account ledger. */ }
          if (!stillCurrent()) return;
          publish(runner.snapshot());
          setView(previous => ({ ...previous, loaded: true }));
          void syncNow();
          timer = setInterval(onReturn, 30000);
          appListener = AppState.addEventListener('change', state => { if (state === 'active') onReturn(); });
          if (Platform.OS === 'web') { window.addEventListener('online', onReturn); window.addEventListener('focus', onReturn); }
        }
      } catch { if (stillCurrent()) setView(previous => ({ ...previous, loaded: false, loadError: true })); }
    })();
    return () => {
      cancelled = true; clearInterval(timer); appListener?.remove();
      if (Platform.OS === 'web') { window.removeEventListener('online', onReturn); window.removeEventListener('focus', onReturn); }
      localRunner?.stopSync();
      if (engine.current === localRunner) engine.current = null;
    };
  }, [scope, authReady, reload, syncNow]);

  async function write(action: (runner: CloudLedger) => Promise<void>, local: (entries: Entry[]) => Entry[]) {
    if (!current.loaded || writeLock.current) return false;
    writeLock.current = true;
    setView(previous => ({ ...previous, busy: true, saveError: '' }));
    try {
      if (scope === 'guest') {
        const records = local(guest.current);
        await AsyncStorage.setItem(STORAGE_KEY, encodeLedger(records));
        if (activeScope.current === scope) { guest.current = records; setView(previous => ({ ...previous, entries: records })); }
      } else {
        const runner = engine.current;
        if (!runner || runner.userId !== scope) throw new Error('Account changed');
        await action(runner);
        if (activeScope.current === scope) void syncNow();
      }
      return activeScope.current === scope;
    } catch {
      if (activeScope.current === scope) setView(previous => ({ ...previous,
        saveError: 'Could not save. Your existing records are unchanged. Please try again.' }));
      return false;
    } finally {
      writeLock.current = false;
      if (activeScope.current === scope) setView(previous => ({ ...previous, busy: false }));
    }
  }

  return { ...current,
    load: () => setReload(value => value + 1), syncNow,
    add: (entry: Entry) => write(runner => runner.add(entry), records => [entry, ...records]),
    remove: (id: string) => write(runner => runner.remove(id), records => records.filter(entry => entry.id !== id)),
    importLocal: () => write(async runner => {
      const records = decodeLedger(await AsyncStorage.getItem(STORAGE_KEY));
      await runner.importLocal(records);
    }, records => records),
  };
}
