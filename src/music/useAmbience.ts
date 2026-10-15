import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { AMBIENCE_SOURCE, AMBIENCE_VOLUME } from './track';
import useMusicPreference from './useMusicPreference';

export default function useAmbience() {
  const preference = useMusicPreference();
  const player = useAudioPlayer(AMBIENCE_SOURCE);
  const status = useAudioPlayerStatus(player);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState('');
  const wanted = useRef(false);
  useEffect(() => {
    player.loop = true; player.volume = AMBIENCE_VOLUME;
    async function start() {
      if (!wanted.current) return;
      setStarting(true);
      try {
        await setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' });
        if (!wanted.current || AppState.currentState !== 'active') { setStarting(false); return; }
        player.play();
      } catch { setStarting(false); setProblem('Music couldn’t start. Turn it off and on to try again.'); }
    }
    wanted.current = preference.ready && preference.enabled;
    if (wanted.current) void start(); else { player.pause(); setStarting(false); }
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { player.pause(); setStarting(false); }
      else void start();
    });
    return () => { wanted.current = false; subscription.remove(); };
  }, [player, preference.ready, preference.enabled]);
  useEffect(() => {
    if (status.error) { setStarting(false); setProblem('Music couldn’t load. Turn it off and on to try again.'); }
    else if (status.playing) setStarting(false);
  }, [status.error, status.playing]);
  function toggle() {
    if (!preference.ready) return;
    const next = !preference.enabled;
    if (!next) { wanted.current = false; player.pause(); setStarting(false); }
    if (next && status.error) player.replace(AMBIENCE_SOURCE);
    setProblem(''); preference.change(next);
  }
  return { playing: status.playing, starting, waitingForTap: false, enabled: preference.enabled,
    ready: preference.ready, problem: problem || preference.problem, toggle };
}
