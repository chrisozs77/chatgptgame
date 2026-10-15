import type { Entry } from './ledger';
export type DateFilter = number | 'all';
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function newestFirst(entries: Entry[]) {
  return [...entries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
}
export function filterHistory(entries: Entry[], year: DateFilter, month: DateFilter) {
  return newestFirst(entries).filter(entry => {
    const date = new Date(entry.createdAt);
    return (year === 'all' || date.getFullYear() === year) && (month === 'all' || date.getMonth() + 1 === month);
  });
}
export function historyYears(entries: Entry[]) {
  return [...new Set(entries.map(entry => new Date(entry.createdAt).getFullYear()))].sort((a, b) => b - a);
}
