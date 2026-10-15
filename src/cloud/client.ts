import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { projectConfig } from './config';
import { CloudRecord, Remote, validateRecords } from './engine';

const config = projectConfig(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
export const cloudProjectUrl = config.url;
export const AUTH_STORAGE_KEY = `degen-tracker.auth.${encodeURIComponent(config.url)}`;
export const cloud = config ? createClient(config.url, config.publishableKey, {
  auth: { storage: AsyncStorage, storageKey: AUTH_STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
}) : null;

export function remoteForUser(client: SupabaseClient, userId: string): Remote {
  async function checkAccount() {
    const { data, error } = await client.auth.getSession();
    if (error || data.session?.user.id !== userId) throw new Error('Sign in again to sync this account.');
  }
  return {
    async supportsEdits() {
      await checkAccount();
      const { error } = await client.from('degen_ledger_entries').select('revision').limit(0);
      if (error?.code === '42703' || error?.code === 'PGRST204') return false;
      if (error) throw new Error('Could not check cloud editing availability.');
      return true;
    },
    async push(records) {
      await checkAccount();
      for (let start = 0; start < records.length; start += 250) {
        const { error } = await client.from('degen_ledger_entries').upsert(records.slice(start, start + 250).map(record => ({
          user_id: userId, id: record.id, result: record.result, cents: record.cents,
          note: record.note, created_at: record.createdAt, deleted: record.deleted,
          ...(record.revision ? { revision: record.revision } : {}),
        })), { onConflict: 'user_id,id' });
        if (error) throw new Error('Cloud save failed. Your results remain on this device; try syncing again.');
      }
    },
    async pull() {
      await checkAccount();
      const records: CloudRecord[] = [];
      for (let start = 0; ; start += 1000) {
        const { data, error } = await client.from('degen_ledger_entries').select('*').eq('user_id', userId).order('id').range(start, start + 999);
        if (error || !data) throw new Error('Could not read cloud results. Your local records are unchanged.');
        records.push(...data.map(record => ({ id: record.id, result: record.result, cents: record.cents,
          note: record.note, createdAt: new Date(record.created_at).toISOString(), deleted: record.deleted, revision: record.revision ?? '' })));
        if (data.length < 1000) break;
      }
      return validateRecords(records);
    },
  };
}
