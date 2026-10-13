import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
const gold = '#ffd575';

export default function InstallApp() {
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [tips, setTips] = useState(false);
  useEffect(() => {
    const checkInstalled = () => setInstalled(window.matchMedia('(display-mode: standalone)').matches ||
      !!(navigator as Navigator & { standalone?: boolean }).standalone);
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const complete = () => { setInstalled(true); setPrompt(null); setTips(false); };
    checkInstalled();
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', complete);
    return () => { window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', complete); };
  }, []);

  async function install() {
    if (!prompt) { setTips(true); return; }
    try {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    } catch { setPrompt(null); setTips(true); }
  }
  if (installed) return null;
  return <>
    <Pressable accessibilityRole="button" onPress={() => void install()} style={s.install}><Text style={s.buttonText}>INSTALL APP</Text></Pressable>
    {tips && <Modal visible transparent animationType="fade" onRequestClose={() => setTips(false)}>
      <View style={s.backdrop}><View accessibilityViewIsModal style={s.card}>
        <Text accessibilityRole="header" style={s.title}>TAKE IT WITH YOU</Text>
        <Text style={s.body}>On iPhone, open this link in Safari. Tap Share, then Add to Home Screen. If shown, enable Open as Web App and tap Add.</Text>
        <Text style={s.body}>On Android or desktop, look for Install app in your browser’s menu. The install option needs the hosted HTTPS version.</Text>
        <Text style={s.body}>Open the app online once to prepare offline use. Each device keeps its own records.</Text>
        <Pressable accessibilityRole="button" onPress={() => setTips(false)} style={s.close}><Text style={[s.buttonText, { color: '#11121b' }]}>GOT IT</Text></Pressable>
      </View></View>
    </Modal>}
  </>;
}
const s = StyleSheet.create({
  install: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#7c6740', paddingHorizontal: 18, marginTop: 8 },
  buttonText: { fontFamily: 'PressStart2P_400Regular', fontSize: 9, lineHeight: 16, color: gold },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#000000bb' },
  card: { width: '100%', maxWidth: 390, backgroundColor: '#1b1d2b', borderWidth: 2, borderColor: '#343749', padding: 22, gap: 18 },
  title: { fontFamily: 'PressStart2P_400Regular', fontSize: 10, lineHeight: 20, color: gold },
  body: { fontSize: 14, lineHeight: 22, color: '#f5f0df' },
  close: { backgroundColor: gold, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
});
