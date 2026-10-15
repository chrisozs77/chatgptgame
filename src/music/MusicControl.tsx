import { Pressable, StyleSheet, Text, View } from 'react-native';
import useAmbience from './useAmbience';
import { TRACK_ARTIST, TRACK_TITLE } from './track';

export default function MusicControl() {
  const music = useAmbience();
  const active = music.enabled;
  return <View testID="music-controls" style={s.shell}>
    {!!music.problem && <Text accessibilityRole="alert" style={s.problem}>{music.problem}</Text>}
    <View style={s.row}>
      <View style={s.credit}><Text numberOfLines={1} style={s.title}>{TRACK_TITLE}</Text><Text numberOfLines={1} style={s.artist}>{music.waitingForTap ? 'Tap the page to start audio' : `${TRACK_ARTIST} · ${active ? 'low ambience' : 'music off'}`}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={active ? 'Mute background music' : 'Unmute background music'}
        disabled={!music.ready} accessibilityState={{ disabled: !music.ready }}
        accessibilityHint={active ? 'Stops background music and remembers your choice on this device.' : 'Enables quiet background music and remembers your choice on this device.'}
        onPress={() => void music.toggle()} style={[s.button, active && s.on]}>
        <View accessible={false} style={s.speaker}><Text style={[s.glyph, active && { color: '#11121b' }]}>{active ? '♪' : '×'}</Text></View>
        <Text style={[s.label, active && { color: '#11121b' }]}>{active ? 'MUTE MUSIC' : 'MUSIC OFF'}</Text>
      </Pressable>
    </View>
  </View>;
}
const s = StyleSheet.create({
  shell: { backgroundColor: '#11121b', borderTopWidth: 1, borderTopColor: '#343749', paddingHorizontal: 12, paddingVertical: 5 },
  row: { width: '100%', maxWidth: 520, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8 },
  credit: { flex: 1, minWidth: 0 }, title: { color: '#a5a6b7', fontSize: 11, lineHeight: 17 },
  artist: { color: '#818498', fontSize: 9, lineHeight: 15 },
  button: { minHeight: 44, paddingHorizontal: 10, borderWidth: 1, borderColor: '#7c6740', flexDirection: 'row', alignItems: 'center', gap: 7 },
  on: { backgroundColor: '#ffd575', borderColor: '#ffd575' },
  speaker: { width: 13, alignItems: 'center' }, glyph: { color: '#ffd575', fontSize: 21, fontWeight: 'bold' },
  label: { color: '#ffd575', fontFamily: 'PressStart2P_400Regular', fontSize: 7, lineHeight: 15 },
  problem: { color: '#ff929e', fontSize: 12, lineHeight: 18, maxWidth: 520, width: '100%', alignSelf: 'center', paddingVertical: 3 },
});
