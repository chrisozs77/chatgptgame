import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatMessage, classify, guidedReply, MAX_MESSAGE } from '../src/support/guidance';

test('gambling support distinguishes chasing losses, urges, boundaries, and money pressure', () => {
  assert.equal(classify('I lost $100 and need to win it back'), 'loss');
  assert.equal(classify('I want to gamble tonight'), 'urge');
  assert.equal(classify('I need a self-exclusion block'), 'limits');
  assert.equal(classify('I cannot afford rent'), 'money');
  assert.equal(classify('I closed the betting app'), 'pause');
  assert.equal(classify('I won today'), 'win');
});

test('everyday support includes stress, sleep, relationships, and loneliness', () => {
  assert.equal(classify('Work is making me anxious'), 'stress');
  assert.equal(classify('I cannot sleep'), 'sleep');
  assert.equal(classify('I need to tell my partner'), 'relationships');
  assert.equal(classify('I feel alone'), 'loneliness');
  const response = guidedReply('What is the capital of Peru?', []);
  assert.equal(response.topic, 'general');
  assert.match(response.text, /prepared guidance/);
});

test('follow-up replies carry context and offer another practical step', () => {
  const first = guidedReply('I want to gamble', []);
  const history: ChatMessage[] = [{ id: 1, role: 'assistant', ...first }];
  const next = guidedReply('Usually when I am bored', history);
  assert.equal(next.topic, 'urge');
  assert.notEqual(first.text, next.text);
  assert.match(next.text, /someone you trust/);
  const changed = guidedReply('Actually, I cannot sleep', history);
  assert.equal(changed.topic, 'sleep');
});

test('crisis language takes priority over gambling and points to human help', () => {
  for (const message of ['I lost everything and want to die', 'I want to kill myself', 'I might self-harm', 'I want to hurt someone']) {
    const result = guidedReply(message, []);
    assert.equal(result.topic, 'crisis');
    assert.match(result.text, /local emergency number/);
    assert.match(result.text, /In the US, call or text 988/);
  }
  assert.notEqual(classify('That betting session killed my mood'), 'crisis');
  const history: ChatMessage[] = [{ id: 1, role: 'assistant', ...guidedReply('I want to die', []) }];
  assert.equal(guidedReply('What else can we discuss?', history).topic, 'general');
});

test('betting tips are redirected and messages are bounded', () => {
  const result = guidedReply('What are the best bets to win back my losses?', []);
  assert.equal(result.topic, 'strategy');
  assert.match(result.text, /don’t provide betting picks/);
  assert.throws(() => guidedReply(' ', []));
  assert.throws(() => guidedReply('a'.repeat(MAX_MESSAGE + 1), []));
  assert.equal(guidedReply('a'.repeat(MAX_MESSAGE), []).topic, 'general');
});
