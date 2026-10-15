import { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Entry, money, summarize } from './ledger';
import EntryRow, { EntryActions } from './EntryRow';
import { DateFilter, filterHistory, historyYears, MONTHS } from './history';
type Props = EntryActions & { entries: Entry[]; year: DateFilter; month: DateFilter; setYear(value: DateFilter): void; setMonth(value: DateFilter): void };
export default function HistoryScreen(props: Props) {
  const [picker, setPicker] = useState<'month' | 'year' | null>(null);
  const filtered = filterHistory(props.entries, props.year, props.month);
  const totals = summarize(filtered);
  const years = [...new Set([...historyYears(props.entries), ...(props.year === 'all' ? [] : [props.year])])].sort((a, b) => b - a);
  const options = picker === 'month' ? MONTHS.map((label, index) => ({ label, value: index + 1 })) : years.map(year => ({ label: String(year), value: year }));
  const selected = picker === 'month' ? props.month : props.year;
  function choose(value: DateFilter) { if (picker === 'month') props.setMonth(value); else props.setYear(value); setPicker(null); }
  return <View style={s.screen}>
    <FlatList testID="full-history" data={filtered} keyExtractor={entry => entry.id} style={{ flex: 1 }}
      contentContainerStyle={s.content} initialNumToRender={15} keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<View>
        <Text style={s.eyebrow}>EVERY SESSION, IN ONE PLACE</Text><Text accessibilityRole="header" style={s.title}>HISTORY<Text style={{ color: '#ffd575' }}>_</Text></Text>
        <Text style={s.subtitle}>Your full log. Newest entries first.</Text>
        <View style={s.filters}>
          <Pressable accessibilityRole="button" accessibilityLabel="Year filter" onPress={() => setPicker('year')} style={s.filter}>
            <Text style={s.filterLabel}>YEAR</Text><Text style={s.filterValue}>{props.year === 'all' ? 'ALL YEARS' : props.year} ↓</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Month filter" onPress={() => setPicker('month')} style={s.filter}>
            <Text style={s.filterLabel}>MONTH</Text><Text style={s.filterValue}>{props.month === 'all' ? 'ALL MONTHS' : MONTHS[props.month - 1].toUpperCase()} ↓</Text></Pressable>
        </View>
        <View style={s.summary}><Text style={s.summaryText}>{filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}</Text>
          <Text accessibilityLabel={`History net profit ${money(totals.net)}`} style={[s.net, { color: totals.net < 0 ? '#ff929e' : '#a0e8b0' }]}>{money(totals.net, true)}</Text></View>
        {!props.editEnabled && <Text style={s.hint}>Editing becomes available after cloud sync checks for the latest update.</Text>}
      </View>}
      renderItem={({ item }) => <EntryRow entry={item} busy={props.busy} editEnabled={props.editEnabled} onEdit={props.onEdit} onRemove={props.onRemove} />}
      ListEmptyComponent={<View style={s.empty}><Text style={s.emptyTitle}>NO TRANSACTIONS</Text><Text style={s.subtitle}>No entries match these filters. Choose All to see your full history.</Text></View>}
      ListFooterComponent={<Text style={s.footer}>End of {props.year === 'all' && props.month === 'all' ? 'your full history' : 'filtered history'} · Dates use your device’s timezone</Text>} />
    {picker && <Modal transparent visible animationType="fade" onRequestClose={() => setPicker(null)}>
      <View style={s.backdrop}><View accessibilityViewIsModal style={s.modal}>
        <Text accessibilityRole="header" style={s.modalTitle}>FILTER BY {picker.toUpperCase()}</Text>
        <ScrollView style={{ maxHeight: 380 }}><View role="radiogroup" accessibilityLabel={`${picker} options`}>
          {[{ label: picker === 'month' ? 'All months' : 'All years', value: 'all' as DateFilter }, ...options].map(option => <Pressable key={option.value}
            accessibilityRole="radio" aria-checked={selected === option.value} accessibilityState={{ checked: selected === option.value }}
            onPress={() => choose(option.value)} style={[s.option, selected === option.value && s.chosen]}><Text style={s.optionText}>{option.label}</Text></Pressable>)}
        </View></ScrollView>
        <Pressable accessibilityRole="button" onPress={() => setPicker(null)} style={s.close}><Text style={s.closeText}>CANCEL</Text></Pressable>
      </View></View>
    </Modal>}
  </View>;
}
const s = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: '#11121b' }, content: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 23, paddingBottom: 24 },
  eyebrow: { color: '#a5a6b7', fontSize: 9, fontWeight: '700', letterSpacing: 1 }, title: { fontFamily: 'PressStart2P_400Regular', color: '#f5f0df', fontSize: 24, lineHeight: 34, marginTop: 14 },
  subtitle: { color: '#a5a6b7', fontSize: 13, lineHeight: 21, marginTop: 12, marginBottom: 20 }, filters: { flexDirection: 'row', gap: 10 },
  filter: { flex: 1, minHeight: 72, backgroundColor: '#1b1d2b', borderWidth: 1, borderColor: '#7c6740', padding: 12, gap: 12 },
  filterLabel: { color: '#a5a6b7', fontSize: 9, letterSpacing: 1 }, filterValue: { fontFamily: 'PressStart2P_400Regular', color: '#ffd575', fontSize: 8, lineHeight: 16 },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, gap: 10 }, summaryText: { color: '#a5a6b7', fontSize: 12 }, net: { fontWeight: '700', fontSize: 16 },
  hint: { color: '#a5a6b7', fontSize: 12, lineHeight: 19, marginBottom: 16 }, empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#343749', padding: 20 }, emptyTitle: { fontFamily: 'PressStart2P_400Regular', color: '#f5f0df', fontSize: 9, lineHeight: 18 },
  footer: { color: '#818498', fontSize: 11, lineHeight: 18, marginTop: 22, textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'center', alignItems: 'center', padding: 24 }, modal: { width: '100%', maxWidth: 360, maxHeight: '90%', backgroundColor: '#1b1d2b', borderWidth: 2, borderColor: '#343749', padding: 20, gap: 14 },
  modalTitle: { fontFamily: 'PressStart2P_400Regular', fontSize: 10, lineHeight: 20, color: '#ffd575' }, option: { minHeight: 46, paddingHorizontal: 14, justifyContent: 'center', borderBottomWidth: 1, borderColor: '#343749' },
  chosen: { backgroundColor: '#263d33' }, optionText: { color: '#f5f0df', fontSize: 15 }, close: { minHeight: 44, justifyContent: 'center', alignItems: 'center' }, closeText: { color: '#a5a6b7', fontSize: 12 },
});
