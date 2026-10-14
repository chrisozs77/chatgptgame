import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { cloud } from './client';
import type { AccountIdentity } from './identity';

type Props = { account: AccountIdentity | null; busy: boolean; status: string; pending: number; error: string;
  saveError: string; guestCount: number; syncNow(): Promise<void>; importLocal(): Promise<boolean> };

export default function CloudAccount(props: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState('');
  const [importing, setImporting] = useState(false);
  const isAccount = !!props.account;
  const status = !isAccount ? 'LOCAL ONLY' : props.status === 'synced' ? 'CLOUD SAVED' : props.status === 'syncing' ? 'SYNCING' : props.pending ? `${props.pending} PENDING` : 'SYNC PAUSED';

  async function sendCode() {
    if (!cloud || working) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setProblem('Enter a valid email address.'); return; }
    setWorking(true); setProblem('');
    try {
      const { error } = await cloud.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
      if (error) {
        setProblem(error.code === 'over_email_send_rate_limit' ? 'Too many code requests. Please wait and try again later.' :
          error.code === 'email_address_not_authorized' ? 'Email sign-in is not available for this address yet. Contact the app owner.' :
          'Could not send the code. Try again later or contact the app owner.');
        return;
      }
      setStep('code'); setCode('');
    } catch { setProblem('Could not send the code. Check your connection and try again later.'); }
    finally { setWorking(false); }
  }
  async function verifyCode() {
    if (!cloud || working) return;
    if (!/^\d{6,10}$/.test(code.trim())) { setProblem('Enter the code from your email.'); return; }
    setWorking(true); setProblem('');
    try {
      const { error } = await cloud.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
      if (error) throw error;
      setOpen(false); setCode(''); setStep('email');
    } catch { setProblem('That code could not be verified. Check it or request a new code.'); }
    finally { setWorking(false); }
  }
  async function signOut() {
    if (!cloud || working || props.busy) return;
    setWorking(true); setProblem('');
    try { const { error } = await cloud.auth.signOut({ scope: 'local' }); if (error) throw error; }
    catch { setProblem('Could not sign out. Reconnect and try again.'); }
    finally { setWorking(false); }
  }

  return <View style={s.card}>
    <View style={s.row}><Text style={s.title}>CLOUD BACKUP</Text><Text style={[s.status, { color: props.status === 'synced' && isAccount ? '#a0e8b0' : '#ffd575' }]}>{status}</Text></View>
    <Text style={s.body}>{isAccount ? props.account?.email : cloud ? 'Sign in to back up your logs and restore them on another device.' : 'Cloud backup is not connected yet. Your records are saved on this device.'}</Text>
    {!!props.error && <Text accessibilityLiveRegion="polite" style={s.warning}>{props.error}</Text>}
    {!!problem && !open && <Text accessibilityRole="alert" style={s.warning}>{problem}</Text>}
    {isAccount ? <>
      <View style={s.row}>
        <Pressable accessibilityRole="button" disabled={props.status === 'syncing'} onPress={() => void props.syncNow()} style={s.button}><Text style={s.buttonText}>SYNC NOW</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={props.busy || working} onPress={() => void signOut()} style={s.button}><Text style={s.buttonText}>SIGN OUT</Text></Pressable>
      </View>
      {props.guestCount > 0 && <><Text style={s.body}>{props.guestCount} local-only {props.guestCount === 1 ? 'result' : 'results'} on this device can be copied into this account.</Text><Pressable accessibilityRole="button" disabled={props.busy} onPress={() => setImporting(true)} style={s.button}><Text style={s.buttonText}>BACK UP LOCAL LOGS</Text></Pressable></>}
    </> : cloud && <Pressable accessibilityRole="button" onPress={() => { setStep('email'); setCode(''); setEmail(''); setOpen(true); setProblem(''); }} style={s.button}><Text style={s.buttonText}>SIGN IN / CREATE ACCOUNT</Text></Pressable>}
    {open && <Modal transparent visible animationType="fade" onRequestClose={() => { if (!working) setOpen(false); }}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View accessibilityViewIsModal style={s.modal}>
        <Text accessibilityRole="header" style={s.modalTitle}>{step === 'email' ? 'SAVE YOUR PROGRESS' : 'CHECK YOUR EMAIL'}</Text>
        <Text style={s.body}>{step === 'email' ? 'We’ll email you a sign-in code. No password needed.' : `Enter the code sent to ${email.trim()}.`}</Text>
        {step === 'email' ? <TextInput accessibilityLabel="Account email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" placeholder="you@example.com" placeholderTextColor="#73768b" style={s.input} /> : <TextInput accessibilityLabel="Email sign-in code" value={code} onChangeText={setCode} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={10} placeholder="Email code" placeholderTextColor="#73768b" style={s.input} />}
        {!!problem && <Text accessibilityRole="alert" style={s.warning}>{problem}</Text>}
        <Pressable accessibilityRole="button" disabled={working} onPress={() => void (step === 'email' ? sendCode() : verifyCode())} style={s.primary}><Text style={s.primaryText}>{working ? 'PLEASE WAIT…' : step === 'email' ? 'EMAIL ME A CODE' : 'SIGN IN'}</Text></Pressable>
        {step === 'code' && <Pressable accessibilityRole="button" disabled={working} onPress={() => { setStep('email'); setProblem(''); }} style={s.button}><Text style={s.buttonText}>CHANGE EMAIL / NEW CODE</Text></Pressable>}
        <Pressable accessibilityRole="button" disabled={working} onPress={() => { setOpen(false); setCode(''); setProblem(''); }} style={s.button}><Text style={s.buttonText}>CANCEL</Text></Pressable>
      </View></KeyboardAvoidingView>
    </Modal>}
    {importing && <Modal transparent visible animationType="fade" onRequestClose={() => { if (!props.busy) setImporting(false); }}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View accessibilityViewIsModal style={s.modal}>
        <Text style={s.modalTitle}>BACK UP LOCAL LOGS?</Text><Text style={s.body}>Copy your local-only results into {props.account?.email}? They will be backed up when cloud sync finishes. The original local-only logs will remain on this device.</Text>
        {!!props.saveError && <Text accessibilityRole="alert" style={s.warning}>{props.saveError}</Text>}
        <Pressable accessibilityRole="button" disabled={props.busy} onPress={() => void props.importLocal().then(saved => { if (saved) setImporting(false); })} style={s.primary}><Text style={s.primaryText}>CONFIRM BACKUP</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={props.busy} onPress={() => setImporting(false)} style={s.button}><Text style={s.buttonText}>CANCEL</Text></Pressable>
      </View></KeyboardAvoidingView>
    </Modal>}
  </View>;
}
const s = StyleSheet.create({
  card: { backgroundColor: '#1b1d2b', borderWidth: 1, borderColor: '#343749', padding: 15, marginBottom: 24, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  title: { fontFamily: 'PressStart2P_400Regular', fontSize: 8, color: '#ffd575', lineHeight: 16 },
  status: { fontSize: 9, fontWeight: '700', letterSpacing: 0.7 },
  body: { color: '#a5a6b7', fontSize: 13, lineHeight: 21 },
  warning: { color: '#ff929e', fontSize: 13, lineHeight: 20 },
  button: { borderWidth: 1, borderColor: '#7c6740', minHeight: 44, padding: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: 'PressStart2P_400Regular', fontSize: 8, color: '#ffd575', lineHeight: 16, textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: '#000000bb', padding: 24, justifyContent: 'center', alignItems: 'center' },
  modal: { width: '100%', maxWidth: 390, backgroundColor: '#1b1d2b', padding: 22, borderWidth: 2, borderColor: '#343749', gap: 18 },
  modalTitle: { fontFamily: 'PressStart2P_400Regular', fontSize: 10, color: '#ffd575', lineHeight: 20 },
  input: { backgroundColor: '#11121b', borderWidth: 1, borderColor: '#343749', padding: 14, color: '#f5f0df', fontSize: 16, minHeight: 48 },
  primary: { backgroundColor: '#ffd575', minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: 'PressStart2P_400Regular', fontSize: 9, lineHeight: 18, color: '#11121b' },
});
