import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Entry, money } from './ledger';
export type EntryActions = { busy: boolean; editEnabled: boolean; onEdit(entry: Entry): void; onRemove(entry: Entry): void };
export default function EntryRow({ entry, ...actions }: EntryActions & { entry: Entry }) {
  const color = entry.result === 'gain' ? '#a0e8b0' : '#ff929e';
  const label = `${entry.note || entry.result} ${money(entry.cents)}`;
  return <View style={s.row}>
    <View style={[s.icon, { backgroundColor: entry.result === 'gain' ? '#263d33' : '#402b37' }]}><Text style={[s.sign, { color }]}>{entry.result === 'gain' ? '+' : '-'}</Text></View>
    <View style={s.details}><Text numberOfLines={2} style={s.note}>{entry.note || (entry.result === 'gain' ? 'Gain recorded' : 'Loss recorded')}</Text>
      <Text style={s.date}>{new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {new Date(entry.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</Text></View>
    <View style={s.right}><Text numberOfLines={1} adjustsFontSizeToFit style={[s.amount, { color }]}>{money(entry.result === 'gain' ? entry.cents : -entry.cents, true)}</Text>
      <View style={s.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${label}`} disabled={actions.busy || !actions.editEnabled}
          aria-disabled={actions.busy || !actions.editEnabled}
          onPress={() => actions.onEdit(entry)} style={[s.action, { borderColor: '#7c6740' }, !actions.editEnabled && { opacity: 0.4 }]}><Text style={[s.actionText, { color: '#ffd575' }]}>EDIT</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${label}`} disabled={actions.busy}
          onPress={() => actions.onRemove(entry)} style={s.action}><Text style={s.actionText}>REMOVE</Text></Pressable>
      </View></View>
  </View>;
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 12, paddingLeft: 10, paddingRight: 8, alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#343749', backgroundColor: '#1b1d2b' },
  icon: { width: 26, height: 30, justifyContent: 'center', alignItems: 'center' }, sign: { fontFamily: 'PressStart2P_400Regular', fontSize: 12 },
  details: { flex: 1, minWidth: 0, gap: 6 }, note: { color: '#f5f0df', fontSize: 13, fontWeight: '600', lineHeight: 18 }, date: { color: '#a5a6b7', fontSize: 9, lineHeight: 15 },
  right: { width: 104, alignItems: 'flex-end' }, amount: { fontSize: 13, fontWeight: '700', maxWidth: 104 },
  actions: { flexDirection: 'row', gap: 4, marginTop: 6 }, action: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderWidth: 1, borderColor: '#343749', backgroundColor: '#11121b' },
  actionText: { color: '#a5a6b7', fontSize: 9, letterSpacing: 0.4 },
});
