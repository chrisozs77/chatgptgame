import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const MUSIC_KEY = 'degen-tracker.music.v1';
export default function useMusicPreference() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState('');
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(MUSIC_KEY).then(value => {
      if (mounted) { setEnabled(value !== 'off'); setReady(true); }
    }).catch(() => {
      if (mounted) { setReady(true); setProblem('Couldn’t read your music preference. Music is off for now.'); }
    });
    return () => { mounted = false; };
  }, []);
  function change(next: boolean) {
    setEnabled(next); setProblem('');
    // Muting takes effect immediately, even if local preference storage fails.
    AsyncStorage.setItem(MUSIC_KEY, next ? 'on' : 'off').catch(() => {
      setProblem('Music changed for now, but your preference couldn’t be saved.');
    });
  }
  return { enabled, ready, problem, change };
}
