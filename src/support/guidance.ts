export type Topic = 'urge' | 'loss' | 'limits' | 'money' | 'stress' | 'relationships' | 'sleep' |
  'loneliness' | 'help' | 'win' | 'pause' | 'general' | 'crisis' | 'strategy';
export type ChatMessage = { id: number; role: 'user' | 'assistant'; text: string; topic?: Topic };
export const WELCOME = 'A moment to pause. I can offer prepared guidance about gambling urges, chasing losses, taking a break, and everyday stress. What’s on your mind?';
export const MAX_MESSAGE = 1000;
export const STARTERS = ['I want to gamble', 'I’m chasing losses', 'I feel stressed', 'Help me take a break'];

const replies: Record<Topic, string[]> = {
  urge: [
    'An urge can feel intense without being something you have to act on. Try a 10-minute pause: close the betting app, step away from the screen, and do something simple like getting water or walking. What usually triggers the urge for you?',
    'Make the next few minutes easier: move away from gambling, put your phone out of reach, and contact someone you trust. You could say, “I’m having an urge to gamble. Can we talk for a bit?” Which of those steps feels possible right now?',
    'Try noticing the urge without fighting it: “I’m having an urge, and I can wait.” Take a few slow breaths and choose one activity away from betting. If urges keep returning, gambling-specific support or self-exclusion can add another layer of help.',
  ],
  loss: [
    'Losing money can bring panic, regret, or a strong pull to win it back. Another bet cannot guarantee recovery and can deepen the loss. For now, close the betting app and pause any new deposits. What would help you step away for the next 10 minutes?',
    'You don’t need to solve the whole loss tonight. Focus on protecting what remains: keep essential spending separate, avoid borrowing to gamble, and speak with someone you trust. If bills are affected, a qualified debt adviser can help you plan the next step.',
    'A painful session does not define your worth. Returning to gambling to undo it can keep the cycle going. Consider blocking access or using self-exclusion, then make one small plan for the rest of today that doesn’t involve betting.',
  ],
  limits: [
    'A useful boundary is one you can put in place before an urge hits. A break, self-exclusion, blocking betting apps, or a gambling block through your bank may help. If limits keep getting crossed, stopping and seeking support is a reasonable next step. Which boundary would you like to start with?',
    'Keep the plan small and concrete: choose a period without gambling, remove an easy route to deposits, and tell a trusted person what you’re trying. Boundaries are support tools, not a test of willpower. What might make your plan difficult today?',
    'If a boundary hasn’t held, you can strengthen the surroundings rather than blaming yourself: add a block, reduce access to betting, or ask a support service about self-exclusion. One practical change today is enough to start.',
  ],
  money: [
    'Money pressure can make a “quick fix” feel tempting, but gambling can worsen that pressure. Protect essentials first and avoid borrowing to place another bet. A free, qualified debt-advice service can help you look at bills and repayment options. Is there an essential expense you’re worried about?',
    'Try separating today’s tasks: list essential bills, pause gambling deposits, and contact a qualified debt adviser or the organisation you owe. You don’t have to share amounts here. Would it help to make a short list of who to contact?',
    'A gambling loss can feel urgent, but you deserve time to make a safer decision. Avoid trying to recover it through more gambling. Ask a trusted person or debt adviser to help you work through the next practical step.',
  ],
  stress: [
    'When stress builds up, it can help to slow the next minute down. Relax your shoulders, take a few gentle breaths, and notice five things around you. Then choose one small task or a short break. Is the stress mostly about gambling, or something else today?',
    'You could try naming what’s in your control for today and what can wait. Pick one manageable action, such as eating, taking a walk, or replying to one message. If gambling is being used as an escape, choose a break away from betting instead.',
    'It’s okay to ask for support with everyday stress too. A trusted person, counsellor, or healthcare professional can help when it keeps affecting your life. For this moment, would rest, company, or a small practical task feel most useful?',
  ],
  relationships: [
    'Gambling worries can be hard to discuss with people close to you. A simple starting point is: “I’m worried about my gambling, and I’d like some support.” Choose someone who feels safe, and be clear about the kind of help you want. Is there someone you could talk to?',
    'You don’t have to explain everything at once. You can share one concern and one next step, such as taking a break or contacting gambling support. If a conversation feels unsafe, seek help from a support service first.',
    'Rebuilding trust can take time. Small, consistent actions—following through on a break, seeking support, and being honest about what you can manage—can help. You can also ask a counsellor for help preparing a conversation.',
  ],
  sleep: [
    'If gambling or worry is keeping you awake, try stepping away from betting and putting the phone aside. Dim the lights and choose a quiet activity for a little while. The money problem doesn’t have to be solved in bed. What could help you wind down tonight?',
    'A simple wind-down routine can make the night feel less frantic: stop gambling, reduce screen time, and do something calm. If sleep problems keep happening or affect your day, talk with a healthcare professional.',
  ],
  loneliness: [
    'Feeling alone can make gambling feel like company or an escape. You deserve connection beyond a betting app. Consider messaging someone, spending time in a shared space, or exploring a peer support group. What is one low-pressure way to connect today?',
    'A short message is enough to start: “Could we catch up? I’ve had a difficult day.” Gambling support groups can also connect you with people who understand. The “Talk to a person” section below has places to begin.',
  ],
  help: [
    'You can ask for gambling support even if you’re unsure how serious things are. A gambling helpline, peer group, counsellor, or healthcare professional can help you explore options without needing a diagnosis. Open “Talk to a person” below to find support for your country.',
    'A first message could be: “I’m worried about my gambling and I want to talk through my options.” You can ask about urges, self-exclusion, money worries, or support for someone close to you. You don’t have to work through it all here.',
  ],
  win: [
    'A win can bring relief or excitement, and it can also create a pull to keep playing. It doesn’t predict the next result. Consider ending the session, stepping away, and keeping money for essentials separate. How are you feeling now that the session is over?',
    'It may help to pause before making any new betting decisions. Give yourself space away from the app and choose something else for the rest of today. What would a good break look like for you?',
  ],
  pause: [
    'Taking a break is a practical step you can build on. Close the betting app, pause deposits, and choose something to do for the next 10 minutes. If it helps, tell someone you trust that you’re stepping away. What would you like to do instead?',
    'You’ve made space for a different choice. To support the break, consider a blocking tool, self-exclusion, or a bank gambling block where available. Pick one manageable step rather than trying to fix everything today.',
    'If you gambled again after a break, that doesn’t erase the steps you took. Pause now, look at what made returning easier, and consider adding outside support. You can begin again with the next small action.',
  ],
  general: [
    'I use prepared guidance, so I can’t understand every situation like a person or a full AI chat can. I can help you think through gambling urges, losses, boundaries, stress, sleep, or talking to someone. Which of those feels closest to what you need?',
    'For an everyday challenge, try choosing one small action you can do today and one person you can ask for support. If you’d like more specific guidance here, tell me whether you’re dealing with stress, gambling urges, money worries, or taking a break.',
  ],
  crisis: [
    'If you or someone else is in immediate danger, call your local emergency number now. If you might hurt yourself, move away from anything you could use to do so and stay with a trusted person if you can. In the US, call or text 988 for crisis support; elsewhere, use Find a Helpline below. This guided chat can’t provide emergency care.',
  ],
  strategy: [
    'I can help with how gambling is affecting you, but I don’t provide betting picks, systems, or advice for winning money back. If there’s pressure to place another bet, we can work on taking a break, managing the urge, or protecting money for essentials.',
  ],
};

export function classify(message: string): Topic | null {
  const text = message.toLowerCase().replace(/[’‘]/g, "'");
  if (/\b(suicid\w*|kill myself|end my life|end it all|hurt myself|harm myself|self[- ]harm|don't want to live|do not want to live|want to die|overdose|kill someone|hurt someone)\b/.test(text)) return 'crisis';
  if (/\b(best bets?|betting (tips|strateg|system)|winning (strateg|system)|guaranteed win|what (should|can) i bet|pick (a |the )?winner|what odds)\w*/.test(text)) return 'strategy';
  if (/\b(chas\w*|win (it |the money )?back|recover (my |the )?loss\w*|lost|loss\w*|rinsed|relaps\w*)\b/.test(text)) return 'loss';
  if (/\b(debt\w*|bills?|rent|borrow\w*|afford|money (worr\w*|problem\w*|stress)|broke|financial\w*)\b/.test(text)) return 'money';
  if (/\b(therap\w*|counsell?\w*|professional|helpline|diagnos\w*|addict\w*|need help|support group)\b/.test(text)) return 'help';
  if (/\b(limit\w*|boundar\w*|block\w*|self[- ]exclu\w*|budget\w*)\b/.test(text)) return 'limits';
  if (/\b(want to|urge\w*|crav\w*|tempt\w*|can't stop|cannot stop|keep|feel like)\b.*\b(gambl\w*|bet\w*|play\w*|casino|slots)\b|\b(urges?|craving|tempted)\b/.test(text)) return 'urge';
  if (/\b(break|pause|stop gambling|quit\w*|stopped|closed|stepped away|walk\w* away|done for (today|tonight))\b/.test(text)) return 'pause';
  if (/\b(won|winning|big win|win today|in profit)\b/.test(text)) return 'win';
  if (/\b(sleep\w*|insomnia|awake|bed|tired|exhaust\w*)\b/.test(text)) return 'sleep';
  if (/\b(lonel\w*|alone|isolat\w*|no friends)\b/.test(text)) return 'loneliness';
  if (/\b(partner|wife|husband|family|parents?|friend\w*|trust|relationship\w*|tell (them|someone))\b/.test(text)) return 'relationships';
  if (/\b(stress\w*|anxious|anxiety|panic\w*|worr\w*|sad|depress\w*|overwhelm\w*|work|school|angry|anger)\b/.test(text)) return 'stress';
  if (/\b(gambl\w*|bet\w*|casino|slots|poker)\b/.test(text)) return 'urge';
  return null;
}

export function guidedReply(message: string, history: ChatMessage[]): Pick<ChatMessage, 'text' | 'topic'> {
  const text = message.trim();
  if (!text || text.length > MAX_MESSAGE) throw new Error('Enter a message of up to 1,000 characters.');
  const previous = [...history].reverse().find(item => item.role === 'assistant' && item.topic);
  const topic = classify(text) ?? (previous?.topic !== 'crisis' && previous?.topic !== 'strategy' ? previous?.topic : undefined) ?? 'general';
  const turns = history.filter(item => item.role === 'assistant' && item.topic === topic).length;
  return { topic, text: replies[topic][turns % replies[topic].length] };
}
