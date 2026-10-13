export type Result = 'gain' | 'loss';
export type Entry = { id: string; result: Result; cents: number; note: string; createdAt: string };
export const STORAGE_KEY = 'degen-tracker.ledger.v1';

// Store integer cents to avoid floating-point drift in money calculations.
export function parseAmount(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return cents > 0 ? cents : null;
}
export function summarize(entries: Entry[]) {
  const gains = entries.filter(e => e.result === 'gain').reduce((n, e) => n + e.cents, 0);
  const losses = entries.filter(e => e.result === 'loss').reduce((n, e) => n + e.cents, 0);
  return { gains, losses, net: gains - losses, count: entries.length };
}
export function money(cents: number, signed = false) {
  const prefix = cents < 0 ? '-' : signed && cents > 0 ? '+' : '';
  return `${prefix}$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function encodeLedger(entries: Entry[]): string { return JSON.stringify({ version: 1, entries }); }
export function decodeLedger(raw: string | null): Entry[] {
  if (raw === null) return [];
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 ||
    !('entries' in data) || !Array.isArray(data.entries)) throw new Error('Invalid ledger');
  const ids = new Set<string>();
  return data.entries.map((e: unknown) => {
    if (!e || typeof e !== 'object') throw new Error('Invalid entry');
    const entry = e as Entry;
    if (typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) ||
      !['gain', 'loss'].includes(entry.result) || !Number.isSafeInteger(entry.cents) ||
      entry.cents <= 0 || entry.cents > 999999999 || typeof entry.note !== 'string' ||
      entry.note.length > 80 || typeof entry.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(entry.createdAt))) throw new Error('Invalid entry');
    ids.add(entry.id);
    return { id: entry.id, result: entry.result, cents: entry.cents, note: entry.note, createdAt: entry.createdAt };
  });
}
export function trend(entries: Entry[]): number[] {
  let total = 0;
  return [...entries].reverse().map(e => (total += e.result === 'gain' ? e.cents : -e.cents)).slice(-16);
}
