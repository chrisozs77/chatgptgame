import test from 'node:test';
import assert from 'node:assert/strict';
import { filterHistory, historyYears, newestFirst } from '../src/history';
import type { Entry } from '../src/ledger';
const row = (id: string, year: number, month: number): Entry => ({ id, result: 'gain', cents: 100, note: id, createdAt: new Date(year, month - 1, 15, 12).toISOString() });
test('full history filters local calendar month and year independently, including All', () => {
  const rows = [row('old', 2024, 3), row('new', 2025, 4), row('march', 2025, 3)];
  assert.deepEqual(filterHistory(rows, 'all', 'all').map(r => r.id), ['new', 'march', 'old']);
  assert.deepEqual(filterHistory(rows, 'all', 3).map(r => r.id), ['march', 'old']);
  assert.deepEqual(filterHistory(rows, 2025, 'all').map(r => r.id), ['new', 'march']);
  assert.deepEqual(filterHistory(rows, 2024, 4), []);
  assert.deepEqual(historyYears(rows), [2025, 2024]);
});
test('recent ten are sorted without discarding or mutating the full ledger', () => {
  const rows = Array.from({ length: 14 }, (_, i) => ({ ...row(String(i), 2025, 1), createdAt: new Date(2025, 0, i + 1, 12).toISOString() }));
  const before = [...rows];
  assert.equal(newestFirst(rows).slice(0, 10)[0].id, '13');
  assert.equal(newestFirst(rows).slice(0, 10).length, 10);
  assert.equal(filterHistory(rows, 'all', 'all').length, 14);
  assert.deepEqual(rows, before);
});
