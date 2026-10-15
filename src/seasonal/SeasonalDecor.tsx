import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DECORATIONS_KEY, nextLocalMidnight, Season, seasonForDate } from './calendar';

export function useSeasonalDecor() {
  const [today, setToday] = useState(() => new Date());
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState('');
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(DECORATIONS_KEY).then(value => {
      if (mounted) { setEnabled(value !== 'off'); setReady(true); }
    }).catch(() => { if (mounted) { setReady(true); setProblem('Couldn’t read your decorations preference.'); } });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function refresh() {
      const now = new Date();
      setToday(now);
      clearTimeout(timer);
      timer = setTimeout(refresh, nextLocalMidnight(now) - now.getTime() + 100);
    }
    refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    // Also refresh after a suspended browser tab or a changed device clock/timezone.
    const focus = () => refresh();
    if (Platform.OS === 'web') window.addEventListener('focus', focus);
    return () => {
      clearTimeout(timer); subscription.remove();
      if (Platform.OS === 'web') window.removeEventListener('focus', focus);
    };
  }, []);
  async function toggle() {
    if (!ready || saving) return;
    setSaving(true); setProblem('');
    try {
      await AsyncStorage.setItem(DECORATIONS_KEY, enabled ? 'off' : 'on');
      setEnabled(!enabled);
    } catch { setProblem('Couldn’t save your decorations preference. Please try again.'); }
    finally { setSaving(false); }
  }
  return { season: ready && enabled ? seasonForDate(today) : null, enabled, ready, saving, problem, toggle };
}

type DecorState = ReturnType<typeof useSeasonalDecor>;
export function SeasonalControl({ decor }: { decor: DecorState }) {
  return <View style={{ marginTop: 16, marginBottom: 4 }}>
    <View style={[s.strip, decor.season && { borderColor: decor.season.accent, backgroundColor: decor.season.tint }]}>
      <Text style={[s.label, decor.season && { color: decor.season.accent }]}>
        {decor.season ? `${decor.season.name.toUpperCase()} EDITION` : 'SEASONAL DECOR'}
      </Text>
      <Pressable accessibilityRole="switch" accessibilityLabel="Seasonal decorations"
        accessibilityHint="Automatically switches holiday decorations using your device’s date."
        accessibilityState={{ checked: decor.enabled, disabled: !decor.ready || decor.saving }}
        aria-checked={decor.enabled} disabled={!decor.ready || decor.saving}
        onPress={() => void decor.toggle()} style={s.toggle}>
        <View style={[s.indicator, decor.enabled && { backgroundColor: decor.season?.accent ?? '#ffd575' }]} />
        <Text style={s.toggleText}>{decor.saving ? '…' : decor.enabled ? 'AUTO' : 'OFF'}</Text>
      </Pressable>
    </View>
    {!!decor.problem && <Text accessibilityRole="alert" style={s.error}>{decor.problem}</Text>}
  </View>;
}

// Bundled pixel artwork: no remote images, animation, or audio downloads.
const art = {
  pumpkin: ['......gg.....','.....gg......','...ppppppp...','..ppppppppp..','.ppppppppppp.','.ppllpppllpp.','.ppllpppllpp.','.ppppplppppp.','.pplppppplpp.','.ppplllllppp.','..ppppppppp..','...ppppppp...'],
  tree: ['......l......','.....ggg.....','....gglgg....','...ggggggg...','..gggrggggg..','....ggggg....','...ggggglg...','..gglgggggg..','.gggggggrggg.','ggggggggggggg','.....ppp.....','.....ppp.....'],
  egg: ['.....vvv.....','....vvvvv....','...vwwwwwv...','..vvvvvvvvv..','..vyyyyyyyv..','.vvvvvvvvvvv.','.vgggggggggv.','.vvvvvvvvvvv.','.vwwwwwwwwwv.','..vvvvvvvvv..','...vvvvvvv...','....vvvvv....'],
  leaf: ['......y......','.....yyy.....','..p..yyy..p..','..pppyyyppp..','.ppppyyypppp.','pppppyyyppppp','.ppppyyypppp.','..pppyyyppp..','...ppyyypp...','....pyyyp....','......p......','......p......'],
  witch: ['......v......','.....vv......','.....vvv.....','....vvvv.....','....vvvvv....','...vvvvvv....','...vvvvvvv...','..vvvvvvvv...','..gggyygggg..','.vvvvvvvvvvv.','vvvvvvvvvvvvv','.............'],
  santa: ['......ww.....','.....wwrr....','.....rrrrr...','....rrrrrr...','....rrrrrrr..','...rrrrrrrr..','...rrrrrrrrr.','..rrrrrrrrrr.','..rrrrrrrrrr.','.wwwwwwwwwww.','wwwwwwwwwwwww','.............'],
  bunny: ['..ww.....ww..','..wvw...wvw..','..wvw...wvw..','..wvw...wvw..','..www...www..','...ww...ww...','...ww...ww...','....wwwww....','...wwwwwww...','..wwwwwwwww..','.wwwwwwwwwww.','.............'],
  pilgrim: ['.............','....xxxxx....','....xxxxx....','...xxxxxxx...','...xxxxxxx...','...xxxxxxx...','..xxxxxxxxx..','..yyyyyyyyy..','..yyyxxyyyy..','.xxxxxxxxxxx.','xxxxxxxxxxxxx','.............'],
};
const palette: Record<string, string> = { p: '#ffad5c', g: '#a0e8b0', x: '#11121b', y: '#ffd575', v: '#c1a0f3', w: '#f5f0df', r: '#ff929e', l: '#ba8d47' };
function PixelArt({ kind, size, lights = false }: { kind: keyof typeof art; size: number; lights?: boolean }) {
  return <View pointerEvents="none" aria-hidden accessible={false} importantForAccessibility="no-hide-descendants">
    {art[kind].map((row, y) => <View key={y} style={{ flexDirection: 'row' }}>
      {[...row].map((pixel, x) => <View key={x} style={{ width: size, height: size,
        backgroundColor: lights ? pixel === 'l' ? '#ffe6a5' : 'transparent' : palette[pixel] ?? 'transparent' }} />)}
    </View>)}
  </View>;
}

export function SeasonalHat({ season }: { season: Season | null }) {
  if (!season) return null;
  const kind = season.id === 'halloween' ? 'witch' : season.id === 'christmas' ? 'santa' : season.id === 'easter' ? 'bunny' : 'pilgrim';
  return <View testID="seasonal-hat" pointerEvents="none" style={s.hat}><PixelArt kind={kind} size={3} /></View>;
}

export function SeasonalCorner({ season }: { season: Season }) {
  const [reduceMotion, setReduceMotion] = useState(true);
  const [opacity] = useState(() => new Animated.Value(0.8));
  useEffect(() => {
    if (Platform.OS === 'web') {
      const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setReduceMotion(preference.matches);
      update(); preference.addEventListener('change', update);
      return () => preference.removeEventListener('change', update);
    }
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (reduceMotion || (season.id !== 'halloween' && season.id !== 'christmas')) { opacity.setValue(0.8); return; }
    const flicker = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.55, duration: 1300, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.timing(opacity, { toValue: 0.95, duration: 1800, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.timing(opacity, { toValue: 0.7, duration: 1100, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.timing(opacity, { toValue: 0.9, duration: 1600, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
    ]));
    flicker.start();
    return () => flicker.stop();
  }, [opacity, reduceMotion, season.id]);
  const kind = season.id === 'halloween' ? 'pumpkin' : season.id === 'christmas' ? 'tree' : season.id === 'easter' ? 'egg' : 'leaf';
  return <View testID="seasonal-corner" pointerEvents="none" style={[s.corner, { borderColor: season.accent, backgroundColor: season.tint }]}>
    <PixelArt kind={kind} size={3} />
    {(season.id === 'halloween' || season.id === 'christmas') &&
      <Animated.View testID="seasonal-lights" pointerEvents="none" style={{ position: 'absolute', left: 9, top: 9, opacity }}>
        <PixelArt kind={kind} size={3} lights />
      </Animated.View>}
  </View>;
}

const s = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderColor: '#343749', paddingLeft: 10 },
  label: { flex: 1, fontFamily: 'PressStart2P_400Regular', fontSize: 7, lineHeight: 15, color: '#a5a6b7' },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, minWidth: 76, paddingHorizontal: 10 },
  indicator: { width: 6, height: 6, backgroundColor: '#606376' },
  toggleText: { fontFamily: 'PressStart2P_400Regular', fontSize: 8, lineHeight: 16, color: '#f5f0df' },
  error: { color: '#ff929e', fontSize: 12, lineHeight: 20, marginTop: 6 },
  hat: { position: 'absolute', top: -30, left: 0, transform: [{ rotate: '-12deg' }] },
  corner: { padding: 9, borderWidth: 2, transform: [{ rotate: '6deg' }] },
});
