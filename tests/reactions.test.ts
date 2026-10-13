import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickReaction, REACTIONS } from '../src/reactions';

test('gains use positive reactions and losses use negative reactions', () => {
  for (const result of ['gain', 'loss'] as const) {
    const other = result === 'gain' ? 'loss' : 'gain';
    for (let i = 0; i < 100; i++) {
      const message = pickReaction(result, undefined, () => i / 100);
      assert.ok(REACTIONS[result].includes(message));
      assert.ok(!REACTIONS[other].includes(message));
    }
  }
});

test('random selection can reach every phrase', () => {
  for (const result of ['gain', 'loss'] as const) {
    const seen = REACTIONS[result].map((_, i) => pickReaction(result, undefined, () => (i + 0.5) / REACTIONS[result].length));
    assert.equal(new Set(seen).size, REACTIONS[result].length);
  }
});

test('consecutive results cannot repeat the same reaction', () => {
  for (const result of ['gain', 'loss'] as const) {
    for (const previous of REACTIONS[result]) {
      for (let i = 0; i < 100; i++) assert.notEqual(pickReaction(result, previous, () => i / 100), previous);
    }
  }
});
