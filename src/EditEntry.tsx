import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Entry, parseAmount, Result } from './ledger';
type Props = { entry: Entry; busy: boolean; error: string; onSave(changes: Pick<Entry, 'result' | 'cents' | 'note'>): Promise<boolean>; onClose(): void };
export default function EditEntry(props: Props) {
  const [result, setResult] = useState<Result>(props.entry.result);
  const [amount, setAmount] = useState((props.entry.cents / 100).toFixed(2));
  const [note, setNote] = useState(props.entry.note);
  const [error, setError] = useState('');
  async function save() {
    const cents = parseAmount(amount);
    if (cents === null) { setError('Enter an amount from $0.01 to $9,999,999.99 with up to 2 decimal places.'); return; }
    setError('');
    await props.onSave({ result, cents, note: note.trim() });
  }
  return <Modal transparent visible animationType="fade" onRequestClose={() => { if (!props.busy) props.onClose(); }}>
    <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View accessibilityViewIsModal style={s.modal}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <Text accessibilityRole="header" style={s.title}>EDIT TRANSACTION</Text>
        <Text style={s.body}>Your original session date stays the same.</Text>
        <View style={s.choices}>{(['gain', 'loss'] as const).map(value => <Pressable key={value} accessibilityRole="button"
          accessibilityLabel={`Edit result: ${value}`} aria-pressed={result === value} disabled={props.busy} onPress={() => setResult(value)}
          style={[s.choice, result === value && { backgroundColor: value === 'gain' ? '#a0e8b0' : '#ff929e' }]}><Text style={[s.choiceText, result === value && { color: '#11121b' }]}>{value.toUpperCase()}</Text></Pressable>)}</View>
        <Text style={s.label}>AMOUNT (USD)</Text><TextInput accessibilityLabel="Edited amount in US dollars" value={amount} onChangeText={value => { setAmount(value); setError(''); }}
          editable={!props.busy} keyboardType="decimal-pad" maxLength={11} style={s.input} />
        <Text style={s.label}>SESSION NOTE</Text><TextInput accessibilityLabel="Edited session note" value={note} onChangeText={setNote} editable={!props.busy} maxLength={80} style={s.input} />
        {!!(error || props.error) && <Text accessibilityRole="alert" style={s.error}>{error || props.error}</Text>}
        <Pressable accessibilityRole="button" disabled={props.busy} onPress={() => void save()} style={s.save}><Text style={s.saveText}>{props.busy ? 'SAVING…' : 'SAVE CHANGES'}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={props.busy} onPress={props.onClose} style={s.cancel}><Text style={s.cancelText}>CANCEL EDIT</Text></Pressable>
      </ScrollView></View>
    </KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000bb', alignItems: 'center', justifyContent: 'center', padding: 24 }, modal: { width: '100%', maxWidth: 390, maxHeight: '90%', borderWidth: 2, borderColor: '#343749', backgroundColor: '#1b1d2b' },
  content: { padding: 22, gap: 15 }, title: { fontFamily: 'PressStart2P_400Regular', color: '#ffd575', fontSize: 10, lineHeight: 21 }, body: { color: '#a5a6b7', fontSize: 13, lineHeight: 20 },
  choices: { flexDirection: 'row', gap: 10 }, choice: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: '#343749', alignItems: 'center', justifyContent: 'center' }, choiceText: { fontFamily: 'PressStart2P_400Regular', fontSize: 9, color: '#a5a6b7', lineHeight: 18 },
  label: { color: '#a5a6b7', fontSize: 10, letterSpacing: 1 }, input: { color: '#f5f0df', fontSize: 16, minHeight: 48, backgroundColor: '#11121b', borderWidth: 1, borderColor: '#343749', padding: 13 },
  error: { color: '#ff929e', fontSize: 13, lineHeight: 20 }, save: { minHeight: 50, backgroundColor: '#ffd575', alignItems: 'center', justifyContent: 'center', padding: 12 }, saveText: { fontFamily: 'PressStart2P_400Regular', color: '#11121b', fontSize: 9, lineHeight: 18 },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: '#a5a6b7', fontSize: 11 },
});
