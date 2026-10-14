import { useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChatMessage, guidedReply, MAX_MESSAGE, STARTERS, WELCOME } from './guidance';

const firstMessage = (): ChatMessage[] => [{ id: 0, role: 'assistant', text: WELCOME }];
const resources = [
  { title: 'Gambling Therapy', detail: 'International gambling support', url: 'https://www.gamblingtherapy.org/' },
  { title: 'Find a Helpline', detail: 'Find human support in your country', url: 'https://findahelpline.com/' },
  { title: 'US crisis support: 988', detail: 'Call or text 988 in the United States', url: 'https://988lifeline.org/' },
];

export default function SupportChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(firstMessage);
  const [draft, setDraft] = useState('');
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [error, setError] = useState('');
  const scroll = useRef<ScrollView>(null);
  const nextId = useRef(1);

  function send(value = draft) {
    const text = value.trim();
    if (!text) return;
    if (text.length > MAX_MESSAGE) { setError('Keep your message under 1,000 characters.'); return; }
    const reply = guidedReply(text, messages);
    setMessages(previous => [...previous.slice(-58), { id: nextId.current++, role: 'user', text },
      { id: nextId.current++, role: 'assistant', ...reply }]);
    setDraft(''); setError('');
    if (reply.topic === 'crisis' || reply.topic === 'help') setResourcesOpen(true);
  }

  async function openResource(url: string) {
    try { await Linking.openURL(url); setError(''); }
    catch { setError('Could not open the support website. Please check your connection.'); }
  }

  return <View style={s.screen}>
    <ScrollView ref={scroll} style={s.scroll} contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled" onContentSizeChange={() => { if (messages.length > 1) scroll.current?.scrollToEnd({ animated: false }); }}>
      <View style={s.header}>
        <View style={{ gap: 10, flex: 1 }}><Text style={s.eyebrow}>TAKE A BREATHER</Text>
          <Text accessibilityRole="header" style={s.title}>SUPPORT<Text style={{ color: '#ffd575' }}>_</Text></Text></View>
        <View style={s.bot} accessible={false}><Text style={s.botEyes}>:)</Text></View>
      </View>
      <Text style={s.subtitle}>A calmer corner of your scoreboard.</Text>
      <View style={s.notice}>
        <Text style={s.noticeTitle}>FREE GUIDED BOT · WORKS OFFLINE</Text>
        <Text style={s.noticeText}>Prepared support responses, not conversational AI or professional care. Chat stays in this session on your device and resets when you reload or change accounts. Your tracker logs aren’t used here.</Text>
      </View>
      <View accessibilityLabel="Support conversation" style={s.conversation}>
        {messages.map(message => <View key={message.id} style={[s.bubble, message.role === 'user' ? s.userBubble : s.botBubble]}>
          <Text style={s.speaker}>{message.role === 'user' ? 'YOU' : 'SUPPORT BOT'}</Text>
          <Text accessibilityLiveRegion={message.role === 'assistant' ? 'polite' : undefined} selectable style={s.message}>{message.text}</Text>
        </View>)}
      </View>
      {messages.length === 1 && <View style={s.starters}>{STARTERS.map(starter => <Pressable key={starter}
        accessibilityRole="button" onPress={() => send(starter)} style={s.starter}><Text style={s.starterText}>{starter}</Text></Pressable>)}</View>}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: resourcesOpen }}
        aria-expanded={resourcesOpen}
        onPress={() => setResourcesOpen(value => !value)} style={s.resourceToggle}><Text style={s.resourceToggleText}>{resourcesOpen ? '−' : '+'} TALK TO A PERSON</Text></Pressable>
      {resourcesOpen && <View style={s.resources}>
        <Text style={s.resourceIntro}>If anyone is in immediate danger, call your local emergency number. These websites need an internet connection.</Text>
        {resources.map(resource => <Pressable key={resource.url} accessibilityRole="link" accessibilityLabel={resource.title}
          onPress={() => void openResource(resource.url)} style={s.resource}><Text style={s.resourceTitle}>{resource.title} ↗</Text><Text style={s.resourceDetail}>{resource.detail}</Text></Pressable>)}
      </View>}
      {messages.length > 1 && <Pressable accessibilityRole="button" onPress={() => {
        setMessages(firstMessage()); setDraft(''); setError(''); setResourcesOpen(false); nextId.current = 1;
        scroll.current?.scrollTo({ y: 0, animated: false });
      }} style={s.clear}><Text style={s.clearText}>CLEAR CHAT</Text></Pressable>}
    </ScrollView>
    <View style={s.composer}>
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      <View style={s.inputRow}><TextInput accessibilityLabel="Message to support bot" value={draft}
        onChangeText={value => { setDraft(value); setError(''); }} maxLength={MAX_MESSAGE}
        placeholder="What’s on your mind?" placeholderTextColor="#818498" multiline
        submitBehavior="submit" returnKeyType="send" onSubmitEditing={() => send()}
        onKeyPress={event => {
          const key = event.nativeEvent as typeof event.nativeEvent & { shiftKey?: boolean; isComposing?: boolean; keyCode?: number };
          if (Platform.OS === 'web' && key.key === 'Enter' && !key.shiftKey && !key.isComposing && key.keyCode !== 229) {
            event.preventDefault(); send();
          }
        }} style={s.input} />
        <Pressable accessibilityRole="button" accessibilityLabel="Send support message" disabled={!draft.trim()}
          onPress={() => send()} style={[s.send, !draft.trim() && { opacity: 0.4 }]}><Text style={s.sendText}>SEND</Text></Pressable></View>
      <Text style={s.composerHint}>One small step at a time.</Text>
    </View>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: '#11121b' }, scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 23, paddingBottom: 16 },
  header: { flexDirection: 'row', gap: 16, alignItems: 'center' }, eyebrow: { color: '#a5a6b7', fontSize: 9, letterSpacing: 1.4, fontWeight: '700' },
  title: { fontFamily: 'PressStart2P_400Regular', color: '#f5f0df', fontSize: 24, lineHeight: 34 },
  bot: { borderWidth: 2, borderColor: '#a0e8b0', backgroundColor: '#263d33', width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  botEyes: { fontFamily: 'PressStart2P_400Regular', color: '#a0e8b0', fontSize: 17, lineHeight: 24 },
  subtitle: { color: '#a5a6b7', fontSize: 13, marginTop: 12, marginBottom: 22 },
  notice: { backgroundColor: '#1b1d2b', borderLeftWidth: 3, borderColor: '#a0e8b0', padding: 14, gap: 10, marginBottom: 22 },
  noticeTitle: { color: '#a0e8b0', fontSize: 9, fontWeight: '700', letterSpacing: 0.8, lineHeight: 16 },
  noticeText: { color: '#a5a6b7', fontSize: 12, lineHeight: 19 }, conversation: { gap: 14 },
  bubble: { padding: 16, borderWidth: 1, gap: 9, maxWidth: '94%' }, botBubble: { backgroundColor: '#1b1d2b', borderColor: '#343749', alignSelf: 'flex-start' },
  userBubble: { backgroundColor: '#302b25', borderColor: '#7c6740', alignSelf: 'flex-end', minWidth: 100 },
  speaker: { fontFamily: 'PressStart2P_400Regular', fontSize: 7, color: '#ffd575', lineHeight: 14 },
  message: { color: '#f5f0df', fontSize: 14, lineHeight: 23 }, starters: { gap: 9, marginTop: 18 },
  starter: { borderWidth: 1, borderColor: '#343749', backgroundColor: '#1b1d2b', padding: 12, minHeight: 44, justifyContent: 'center' },
  starterText: { color: '#a0e8b0', fontSize: 13, lineHeight: 20 },
  resourceToggle: { minHeight: 48, justifyContent: 'center', marginTop: 16 }, resourceToggleText: { fontFamily: 'PressStart2P_400Regular', fontSize: 8, lineHeight: 18, color: '#a0e8b0' },
  resources: { borderWidth: 1, borderColor: '#343749', backgroundColor: '#1b1d2b', padding: 14, gap: 10 },
  resourceIntro: { color: '#a5a6b7', fontSize: 12, lineHeight: 19 }, resource: { borderTopWidth: 1, borderColor: '#343749', minHeight: 58, paddingVertical: 10, gap: 5 },
  resourceTitle: { color: '#a0e8b0', fontSize: 13, fontWeight: '700' }, resourceDetail: { color: '#a5a6b7', fontSize: 12, lineHeight: 19 },
  clear: { minHeight: 44, alignSelf: 'center', justifyContent: 'center', marginTop: 6 }, clearText: { color: '#a5a6b7', fontSize: 10, letterSpacing: 1 },
  composer: { width: '100%', maxWidth: 520, alignSelf: 'center', borderTopWidth: 1, borderColor: '#343749', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, gap: 7 },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' }, input: { flex: 1, minWidth: 0, minHeight: 48, maxHeight: 110, fontSize: 16, lineHeight: 23, color: '#f5f0df', backgroundColor: '#1b1d2b', borderWidth: 1, borderColor: '#343749', padding: 12 },
  send: { backgroundColor: '#a0e8b0', minHeight: 48, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: '#577963' },
  sendText: { fontFamily: 'PressStart2P_400Regular', color: '#11121b', fontSize: 8, lineHeight: 15 }, composerHint: { color: '#818498', fontSize: 10, textAlign: 'center' },
  error: { color: '#ff929e', fontSize: 12, lineHeight: 19 },
});
