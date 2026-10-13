import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeLedger, encodeLedger, Entry, money, parseAmount, summarize, trend } from '../src/ledger';
const entries: Entry[] = [
  { id: 'loss', result: 'loss', cents: 4025, note: 'Poker', createdAt: '2026-10-13T21:00:00.000Z' },
  { id: 'gain', result: 'gain', cents: 10050, note: '', createdAt: '2026-10-12T21:00:00.000Z' },
];
test('decimal amounts are exact, including decimal comma', () => {
  assert.equal(parseAmount('0.01'), 1); assert.equal(parseAmount('0.29'), 29);
  assert.equal(parseAmount(' 125.5 '), 12550); assert.equal(parseAmount('12,34'), 1234);
  assert.equal(parseAmount('9999999.99'), 999999999);
});
test('rejects zero, negatives, ambiguity, overprecision, and over-limit amounts', () => {
  for (const amount of ['', '0', '0.00', '-10', '1e3', '1.234', '1,234.50', '10000000', 'NaN']) assert.equal(parseAmount(amount), null, amount);
});
test('totals mixed results correctly, including removal and empty state', () => {
  assert.deepEqual(summarize(entries), { gains: 10050, losses: 4025, net: 6025, count: 2 });
  assert.equal(summarize(entries.filter(e => e.id !== 'gain')).net, -4025);
  assert.deepEqual(summarize([]), { gains: 0, losses: 0, net: 0, count: 0 });
});
test('money formatting distinguishes gains, losses and zero', () => {
  assert.equal(money(12345, true), '+$123.45'); assert.equal(money(-12345), '-$123.45'); assert.equal(money(0, true), '$0.00');
});
test('ledger round-trip preserves notes, amounts and dates', () => {
  assert.deepEqual(decodeLedger(encodeLedger(entries)), entries); assert.deepEqual(decodeLedger(null), []);
});
test('rejects corrupt saves instead of silently erasing them', () => {
  for (const raw of ['broken', '{}', '{"version":2,"entries":[]}', encodeLedger([{ ...entries[0], cents: -1 }]),
    encodeLedger([{ ...entries[0], createdAt: 'invalid' }]), encodeLedger([entries[0], entries[0]]), encodeLedger([{ ...entries[0], cents: 1.5 }])]) assert.throws(() => decodeLedger(raw));
});
test('trend accumulates results chronologically', () => {
  assert.deepEqual(trend(entries), [10050, 6025]); assert.deepEqual(trend([]), []);
});
