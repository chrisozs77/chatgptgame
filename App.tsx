import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import * as Haptics from 'expo-haptics';
import { Entry, money, parseAmount, Result, summarize, trend } from './src/ledger';
import { pickReaction } from './src/reactions';
import InstallApp from './src/InstallApp';
import CloudAccount from './src/cloud/CloudAccount';
import { useCloudAuth, useDeviceLedger } from './src/cloud/useCloud';
import SupportChat from './src/support/SupportChat';

const C = { bg: '#11121b', card: '#1b1d2b', border: '#343749', text: '#f5f0df', muted: '#a5a6b7',
  gold: '#ffd575', green: '#a0e8b0', red: '#ff929e', shadow: '#080910' };
const pixel = 'PressStart2P_400Regular';

function PixelIcon({ kind = 'dice', size = 4, color = C.gold }: { kind?: 'dice' | 'coin' | 'chat'; size?: number; color?: string }) {
  const rows = kind === 'dice'
    ? ['011111110', '110000011', '101000101', '100000001', '100010001', '100000001', '101000101', '110000011', '011111110']
    : kind === 'chat' ? ['111111111', '100000001', '101010101', '100000001', '111111111', '001010000', '001100000', '001000000', '000000000']
    : ['001111100', '011000110', '110111011', '110100011', '110111011', '110001011', '110111011', '011000110', '001111100'];
  return <View accessible={false}>{rows.map((row, y) => <View key={y} style={{ flexDirection: 'row' }}>
    {[...row].map((v, x) => <View key={x} style={{ width: size, height: size, backgroundColor: v === '1' ? color : 'transparent' }} />)}
  </View>)}</View>;
}

function AppContent() {
  const [fontsLoaded, fontError] = useFonts({ PressStart2P_400Regular });
  const auth = useCloudAuth();
  const ledger = useDeviceLedger(auth.account, auth.ready);
  const { entries, loaded, loadError, busy, load } = ledger;
  const [result, setResult] = useState<Result>('gain');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [reaction, setReaction] = useState<{ entry: Entry; message: string } | null>(null);
  const [filter, setFilter] = useState<'all' | Result>('all');
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const [tab, setTab] = useState<'tracker' | 'support'>('tracker');
  const amountInput = useRef<TextInput>(null);
  useEffect(() => {
    setReaction(null); setAmount(''); setNote(''); setError(''); setDeleting(null); setFilter('all');
  }, [auth.account?.id]);
  const displayError = error || ledger.saveError;

  async function addEntry() {
    if (busy) return;
    const cents = parseAmount(amount);
    if (cents === null) { setError('Enter an amount from $0.01 to $9,999,999.99, with up to 2 decimal places.'); amountInput.current?.focus(); return; }
    setError('');
    const entry: Entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, result, cents, note: note.trim(), createdAt: new Date().toISOString() };
    if (await ledger.add(entry)) {
      setAmount(''); setNote(''); setFilter('all'); Keyboard.dismiss();
      setReaction({ entry, message: pickReaction(entry.result, reaction?.message) });
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }

  async function removeEntry() {
    if (!deleting || busy) return;
    setError('');
    if (await ledger.remove(deleting.id)) {
      setReaction(previous => previous?.entry.id === deleting.id ? null : previous);
      setDeleting(null);
    }
  }

  const totals = summarize(entries);
  const visible = entries.filter(e => filter === 'all' || e.result === filter);
  const points = trend(entries);
  const scale = Math.max(...points.map(Math.abs), 1);
  const balanceColor = totals.net === 0 ? C.text : totals.net > 0 ? C.green : C.red;
  const reactionColor = reaction ? reaction.entry.result === 'gain' ? C.green : C.red : C.muted;

  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <StatusBar style="light" />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.screen, tab !== 'tracker' && s.hidden]}>
      {loadError ? <View style={s.loading}>
        <Text style={s.sectionTitle}>SAVE UNAVAILABLE</Text>
        <Text style={[s.body, { textAlign: 'center' }]}>We couldn’t read your saved results. Your data has not been overwritten.</Text>
        <Pressable accessibilityRole="button" onPress={() => void load()} style={s.primary}><Text style={s.primaryText}>RETRY</Text></Pressable>
      </View> : (!fontsLoaded && !fontError) || !loaded ? <View style={s.loading}>
        <ActivityIndicator color={C.gold} /><Text style={s.body}>Loading your tracker…</Text>
      </View> :
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.topline}><Text style={s.eyebrow}>PERSONAL SCOREBOARD</Text><View style={s.saved}><View style={[s.dot, auth.account && ledger.sync !== 'synced' && { backgroundColor: C.gold }]} /><Text style={[s.savedText, auth.account && ledger.sync !== 'synced' && { color: C.gold }]}>{busy ? 'SAVING' : !auth.account ? 'LOCAL SAVE' : ledger.sync === 'synced' ? 'CLOUD SAVE' : ledger.sync === 'syncing' ? 'SYNCING' : 'LOCAL CACHE'}</Text></View></View>
        <View style={s.header}>
          <View style={{ gap: 9 }}><Text accessibilityRole="header" style={s.title}>DEGEN</Text><Text style={[s.title, { color: C.gold }]}>TRACKER<Text style={{ color: C.muted }}>_</Text></Text></View>
          <View style={s.dice}><PixelIcon size={4} /></View>
        </View>
        <Text style={s.subtitle}>Every gain. Every loss. All in one place.</Text>

        <View style={[s.card, s.balanceCard]}>
          <View style={s.rowBetween}><Text style={s.label}>NET PROFIT</Text><View style={[s.badge, { borderColor: balanceColor }]}><Text style={[s.badgeText, { color: balanceColor }]}>{totals.net === 0 ? 'EVEN' : totals.net > 0 ? 'IN THE GREEN' : 'IN THE RED'}</Text></View></View>
          <Text accessibilityLabel={`Net profit ${money(totals.net)}`} adjustsFontSizeToFit numberOfLines={1} style={[s.balance, { color: balanceColor }]}>{money(totals.net, true)}</Text>
          <View style={s.trend} accessible accessibilityLabel={points.length ? 'Cumulative net profit across recent sessions' : 'No sessions recorded yet'}>
            {points.length ? points.map((p, i) => <View key={i} style={s.barSlot}><View style={{ width: '100%', height: Math.max(3, Math.abs(p) / scale * 24), backgroundColor: p >= 0 ? C.green : C.red, opacity: 0.45 + i / points.length * 0.55 }} /></View>) : Array.from({ length: 22 }, (_, i) => <View key={i} style={[s.barSlot, { height: 2, backgroundColor: C.border }]} />)}
          </View>
          <Text style={s.balanceFoot}>ALL-TIME P/L <Text style={{ color: C.border }}> / </Text> {totals.count} {totals.count === 1 ? 'SESSION' : 'SESSIONS'}</Text>
        </View>
        <View style={s.stats}>
          <View style={[s.stat, { borderTopColor: C.green }]}><Text style={[s.label, { color: C.green }]}>+ TOTAL GAINS</Text><Text numberOfLines={1} adjustsFontSizeToFit style={s.statValue}>{money(totals.gains)}</Text><Text style={s.small}>{entries.filter(e => e.result === 'gain').length} gain entries</Text></View>
          <View style={[s.stat, { borderTopColor: C.red }]}><Text style={[s.label, { color: C.red }]}>- TOTAL LOSSES</Text><Text numberOfLines={1} adjustsFontSizeToFit style={s.statValue}>{money(totals.losses)}</Text><Text style={s.small}>{entries.filter(e => e.result === 'loss').length} loss entries</Text></View>
        </View>

        <CloudAccount account={auth.account} busy={busy} status={ledger.sync} pending={ledger.pending}
          error={ledger.syncError || auth.error} saveError={ledger.saveError} guestCount={ledger.guestCount}
          syncNow={ledger.syncNow} importLocal={ledger.importLocal} />

        <View style={[s.card, s.form]}>
          <View style={s.rowBetween}><Text accessibilityRole="header" style={s.sectionTitle}>LOG A RESULT</Text><Text style={s.pixelPlus}>+</Text></View>
          <View style={s.tabs}>{(['gain', 'loss'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={value === 'gain' ? 'Select gain' : 'Select loss'} accessibilityState={{ selected: result === value }} onPress={() => { setResult(value); setError(''); }} style={[s.tab, result === value && { backgroundColor: value === 'gain' ? C.green : C.red, borderColor: value === 'gain' ? C.green : C.red }]}>
            <Text style={[s.tabText, result === value && { color: C.bg }]}>{value === 'gain' ? '+ GAIN' : '- LOSS'}</Text>
          </Pressable>)}</View>
          <Text style={s.fieldLabel}>AMOUNT <Text style={{ color: C.muted }}>(USD)</Text></Text>
          <View style={[s.amountBox, error && { borderColor: C.red }]}><Text style={s.currency}>$</Text><TextInput ref={amountInput} accessibilityLabel="Amount in US dollars" value={amount} onChangeText={value => { setAmount(value); setError(''); }} placeholder="0.00" placeholderTextColor="#606376" keyboardType="decimal-pad" returnKeyType="done" maxLength={11} style={s.amountInput} onSubmitEditing={() => void addEntry()} /></View>
          <Text style={s.fieldLabel}>SESSION NOTE <Text style={{ color: C.muted }}>(OPTIONAL)</Text></Text>
          <TextInput accessibilityLabel="Session note" value={note} onChangeText={setNote} placeholder="e.g. Friday poker night" placeholderTextColor="#73768b" maxLength={80} style={s.noteInput} returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} />
          {!!displayError && <Text accessibilityRole="alert" style={s.error}>{displayError}</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel={`Log ${result}`} accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void addEntry()} style={({ pressed }) => [s.primary, (pressed || busy) && { opacity: 0.65, transform: [{ translateY: 2 }] }]}>
            <Text style={s.primaryText}>{busy ? 'SAVING…' : `+ LOG ${result.toUpperCase()}`}</Text>
          </Pressable>
          <View style={[s.verdict, { borderLeftColor: reaction ? reactionColor : C.border }]}>
            <View style={s.rowBetween}><Text style={s.verdictLabel}>THE VERDICT</Text><Text style={[s.verdictStatus, { color: reactionColor }]}>{reaction ? `${reaction.entry.result.toUpperCase()} SAVED` : 'STANDBY'}</Text></View>
            <Text testID="verdict-message" accessibilityLiveRegion="polite" style={[s.verdictMessage, { color: reactionColor }]}>{reaction?.message.toUpperCase() || 'WAITING FOR A RESULT'}</Text>
            <Text style={s.verdictDetail}>{reaction ? `${money(reaction.entry.result === 'gain' ? reaction.entry.cents : -reaction.entry.cents, true)} added to your session log` : 'Log a gain or loss to get a reaction.'}</Text>
          </View>
        </View>

        <View style={s.historyHeader}><Text accessibilityRole="header" style={s.sectionTitle}>SESSION LOG</Text><Text style={s.count}>{String(entries.length).padStart(2, '0')}</Text></View>
        <View style={s.filters}>{(['all', 'gain', 'loss'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`Show ${value === 'all' ? 'all results' : value === 'gain' ? 'gains' : 'losses'}`} accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[s.filter, filter === value && s.filterActive]}><Text style={[s.filterText, filter === value && { color: C.gold }]}>{value === 'all' ? 'ALL' : value === 'gain' ? 'GAINS' : 'LOSSES'}</Text></Pressable>)}</View>
        {visible.length === 0 ? <View style={s.empty}><PixelIcon kind="coin" color={C.muted} size={3} /><Text style={s.emptyTitle}>{entries.length ? 'NO MATCHING RESULTS' : 'A FRESH SCOREBOARD'}</Text><Text style={s.emptyBody}>{entries.length ? 'Choose another filter to see your sessions.' : 'Log your first gain or loss above.\nYour story starts at zero.'}</Text></View> : <View style={s.ledger}>{visible.map(entry => <View key={entry.id} style={s.entry}>
          <View style={[s.resultIcon, { backgroundColor: entry.result === 'gain' ? '#263d33' : '#402b37' }]}><Text style={[s.resultGlyph, { color: entry.result === 'gain' ? C.green : C.red }]}>{entry.result === 'gain' ? '+' : '-'}</Text></View>
          <View style={{ flex: 1, gap: 6 }}><Text numberOfLines={2} style={s.entryNote}>{entry.note || (entry.result === 'gain' ? 'Gain recorded' : 'Loss recorded')}</Text><Text style={s.entryDate}>{new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(entry.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</Text></View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}><Text style={[s.entryAmount, { color: entry.result === 'gain' ? C.green : C.red }]}>{money(entry.result === 'gain' ? entry.cents : -entry.cents, true)}</Text><Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Delete ${entry.note || entry.result} ${money(entry.cents)}`} onPress={() => setDeleting(entry)} style={s.deleteButton}><Text style={s.deleteText}>REMOVE</Text></Pressable></View>
        </View>)}</View>}
        <View style={s.footer}><View style={s.footerRule} /><Text style={s.footerText}>YOUR LOGS. YOUR SCOREBOARD.</Text><Text style={s.footerSub}>{auth.account ? 'Local cache + account backup' : 'Saved on this device · sign in for cloud backup'}</Text><InstallApp /></View>
      </ScrollView>}
      </View>
      <View style={[s.screen, tab !== 'support' && s.hidden]}>
        <SupportChat key={auth.account?.id ?? 'guest'} />
      </View>
      <View style={s.navigation}>
        <View role="tablist" accessibilityLabel="Main navigation" style={s.navigationInner}>
          {(['tracker', 'support'] as const).map(destination => <Pressable key={destination}
            accessibilityRole="tab" accessibilityLabel={destination === 'tracker' ? 'Tracker' : 'Support'}
            aria-selected={tab === destination}
            accessibilityState={{ selected: tab === destination }}
            onPress={() => { Keyboard.dismiss(); setTab(destination); }}
            style={[s.navigationTab, tab === destination && s.navigationSelected]}>
            <PixelIcon kind={destination === 'tracker' ? 'dice' : 'chat'} size={2} color={tab === destination ? C.gold : C.muted} />
            <Text style={[s.navigationLabel, tab === destination && { color: C.gold }]}>{destination.toUpperCase()}</Text>
          </Pressable>)}
        </View>
      </View>
    </KeyboardAvoidingView>
    {deleting && <Modal visible transparent animationType="fade" onRequestClose={() => { if (!busy) setDeleting(null); }}>
      <View style={s.modalBackdrop}><View accessibilityViewIsModal style={[s.card, s.modalCard]}>
        <Text style={s.sectionTitle}>REMOVE RESULT?</Text><Text style={s.body}>Remove {deleting ? money(deleting.cents) : ''} from your session log? Your totals will be updated. This cannot be undone.</Text>
        {!!displayError && <Text accessibilityRole="alert" style={s.error}>{displayError}</Text>}
        <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Confirm removal" onPress={() => void removeEntry()} style={[s.primary, { backgroundColor: C.red }]}><Text style={s.primaryText}>{busy ? 'REMOVING…' : 'REMOVE RESULT'}</Text></Pressable>
        <Pressable disabled={busy} accessibilityRole="button" onPress={() => { setDeleting(null); setError(''); }} style={s.cancel}><Text style={s.tabText}>KEEP IT</Text></Pressable>
      </View></View>
    </Modal>}
  </SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><AppContent /></SafeAreaProvider>; }

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  screen: { flex: 1, minHeight: 0 }, hidden: { display: 'none' },
  navigation: { backgroundColor: C.card, borderTopWidth: 2, borderColor: C.border },
  navigationInner: { flexDirection: 'row', width: '100%', maxWidth: 520, alignSelf: 'center' },
  navigationTab: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12, borderTopWidth: 3, borderTopColor: 'transparent' },
  navigationSelected: { borderTopColor: C.gold, backgroundColor: '#25252d' },
  navigationLabel: { fontFamily: pixel, fontSize: 9, lineHeight: 18, color: C.muted },
  loading: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', gap: 24, padding: 32 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 23, paddingBottom: 30 },
  topline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25, gap: 6 },
  eyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 1.4, color: C.muted },
  saved: { flexDirection: 'row', gap: 6, alignItems: 'center' }, dot: { width: 5, height: 5, backgroundColor: C.green },
  savedText: { color: C.green, fontSize: 9, fontWeight: '700', letterSpacing: 0.7 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: pixel, fontSize: 26, lineHeight: 34, color: C.text, letterSpacing: -0.7 },
  dice: { padding: 11, borderWidth: 2, borderColor: C.border, transform: [{ rotate: '8deg' }], backgroundColor: C.card },
  subtitle: { color: C.muted, fontSize: 13, marginTop: 12, marginBottom: 26 },
  card: { backgroundColor: C.card, borderWidth: 2, borderColor: C.border, borderBottomWidth: 5, borderBottomColor: C.shadow },
  balanceCard: { padding: 20, borderTopColor: C.gold }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { fontFamily: pixel, fontSize: 8, lineHeight: 15, color: C.muted },
  badge: { borderWidth: 1, paddingVertical: 5, paddingHorizontal: 6 }, badgeText: { fontSize: 8, letterSpacing: 0.8, fontWeight: '800' },
  balance: { fontFamily: pixel, fontSize: 30, lineHeight: 48, marginTop: 16 },
  trend: { flexDirection: 'row', height: 30, gap: 4, alignItems: 'center', marginTop: 9, marginBottom: 12 },
  barSlot: { flex: 1, justifyContent: 'center' }, balanceFoot: { color: C.muted, fontSize: 9, letterSpacing: 1.2, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 26 },
  stat: { flex: 1, backgroundColor: C.card, borderWidth: 1, borderTopWidth: 2, borderColor: C.border, padding: 14, gap: 9 },
  statValue: { color: C.text, fontFamily: pixel, fontSize: 13, lineHeight: 20 }, small: { color: C.muted, fontSize: 11 },
  form: { padding: 18 }, sectionTitle: { fontFamily: pixel, fontSize: 11, lineHeight: 19, color: C.text },
  pixelPlus: { fontFamily: pixel, fontSize: 18, color: C.gold }, tabs: { flexDirection: 'row', gap: 8, marginTop: 20, marginBottom: 20 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 46, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  tabText: { fontFamily: pixel, fontSize: 10, color: C.muted, lineHeight: 17 },
  fieldLabel: { color: C.text, fontSize: 9, letterSpacing: 1, fontWeight: '700', marginBottom: 9 },
  amountBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, marginBottom: 18 },
  currency: { fontFamily: pixel, fontSize: 22, color: C.gold }, amountInput: { flex: 1, color: C.text, fontFamily: pixel, fontSize: 24, paddingVertical: 20, minWidth: 0 },
  noteInput: { color: C.text, fontSize: 14, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, paddingHorizontal: 13, paddingVertical: 15, marginBottom: 19 },
  primary: { backgroundColor: C.gold, paddingHorizontal: 18, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: '#b48b43', minHeight: 54 },
  primaryText: { fontFamily: pixel, fontSize: 11, color: C.bg, lineHeight: 18 },
  verdict: { backgroundColor: C.bg, borderLeftWidth: 3, padding: 14, marginTop: 18, gap: 12, minHeight: 116 },
  verdictLabel: { fontFamily: pixel, fontSize: 7, lineHeight: 13, color: C.gold },
  verdictStatus: { fontSize: 8, letterSpacing: 0.8, fontWeight: '700' },
  verdictMessage: { fontFamily: pixel, fontSize: 12, lineHeight: 22 },
  verdictDetail: { color: C.muted, fontSize: 11, lineHeight: 17 },
  error: { color: C.red, fontSize: 13, lineHeight: 20, marginBottom: 14 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 30, marginBottom: 16 },
  count: { fontFamily: pixel, fontSize: 10, color: C.muted, backgroundColor: C.card, padding: 8 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 13 }, filter: { minHeight: 44, paddingHorizontal: 16, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
  filterActive: { backgroundColor: '#302b25', borderColor: '#7c6740' }, filterText: { fontFamily: pixel, fontSize: 8, color: C.muted },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 16, borderColor: C.border, borderWidth: 1, borderStyle: 'dashed' },
  emptyTitle: { color: C.text, fontFamily: pixel, fontSize: 8, lineHeight: 17 }, emptyBody: { color: C.muted, fontSize: 13, lineHeight: 21, textAlign: 'center', paddingHorizontal: 12 },
  ledger: { borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  entry: { flexDirection: 'row', paddingVertical: 14, paddingLeft: 12, paddingRight: 8, alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  resultIcon: { width: 30, height: 34, justifyContent: 'center', alignItems: 'center' }, resultGlyph: { fontFamily: pixel, fontSize: 13 },
  entryNote: { color: C.text, fontSize: 13, fontWeight: '600', lineHeight: 18 }, entryDate: { color: C.muted, fontSize: 9, lineHeight: 15 },
  entryAmount: { fontSize: 13, fontWeight: '700', maxWidth: 125 }, deleteButton: { minHeight: 44, minWidth: 58, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 3 }, deleteText: { fontSize: 8, letterSpacing: 0.8, color: C.muted },
  footer: { alignItems: 'center', marginTop: 26, gap: 10 }, footerRule: { width: 24, height: 3, backgroundColor: C.gold, marginBottom: 6 },
  footerText: { color: C.muted, fontFamily: pixel, fontSize: 7, lineHeight: 13 }, footerSub: { color: '#818498', fontSize: 11 },
  body: { color: C.muted, fontSize: 15, lineHeight: 24 },
  modalBackdrop: { flex: 1, backgroundColor: '#000000bb', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 390, padding: 22, gap: 20 }, cancel: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
});
