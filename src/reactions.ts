import type { Result } from './ledger';

export const REACTIONS: Record<Result, readonly string[]> = {
  gain: [
    'Gamblers Prevail',
    'Never Stop!',
    'Lock In',
    'We Take Those',
    'Big W Energy',
    'Green Looks Good',
    'Scoreboard Approved',
  ],
  loss: [
    'Rinsed Again',
    'Dear God',
    'Another Disaster',
    'Nightmare',
    'Emotional Damage',
    'That One Hurt',
    'Wallet Took A Hit',
    'Plot Twist',
  ],
};

export function pickReaction(result: Result, previous?: string, random = Math.random): string {
  const choices = REACTIONS[result].filter(message => message !== previous);
  return choices[Math.floor(random() * choices.length)];
}
