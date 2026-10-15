import { useCallback, useEffect, useRef, useState } from 'react';
import { Asset } from 'expo-asset';
import { AMBIENCE_SOURCE, AMBIENCE_VOLUME } from './track';
import useMusicPreference from './useMusicPreference';

export default function useAmbience() {
  const preference = useMusicPreference();
  const audio = useRef<HTMLAudioElement | null>(null);
  const request = useRef(0);
  const wanted = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState('');
  const [waitingForTap, setWaitingForTap] = useState(false);
  const pause = useCallback(() => {
    request.current++;
    audio.current?.pause(); setPlaying(false); setStarting(false);
  }, []);

  const start = useCallback(() => {
    const media = audio.current;
    if (!media || !wanted.current || document.hidden || !media.paused) return;
    const currentRequest = ++request.current;
    setStarting(true); setProblem(''); setWaitingForTap(false);
    if (media.error) media.load();
    media.play().then(() => {
      if (request.current !== currentRequest) return;
      if (!wanted.current || document.hidden) { media.pause(); return; }
      setStarting(false); setPlaying(!media.paused);
    }).catch(error => {
      if (request.current !== currentRequest) return;
      pause();
      if (error?.name === 'NotAllowedError') setWaitingForTap(true);
      else setProblem('Music couldn’t start. Tap the page to try again.');
    });
  }, [pause]);

  useEffect(() => {
    const media = new Audio(Asset.fromModule(AMBIENCE_SOURCE).uri);
    media.preload = 'auto'; media.loop = true; media.volume = AMBIENCE_VOLUME;
    audio.current = media;
    const onPlay = () => {
      if (!wanted.current) { media.pause(); return; }
      setPlaying(true); setStarting(false); setProblem('');
    };
    const onPause = () => { setPlaying(false); setStarting(false); };
    const onError = () => { pause(); setProblem('Music couldn’t load. Tap the page to try again.'); };
    const onVisibility = () => { if (document.hidden) pause(); else start(); };
    const onInteraction = (event: Event) => {
      // The music button handles its own action; a mute tap must never start audio.
      if ((event.target as Element | null)?.closest?.('[data-testid="music-controls"]')) return;
      start();
    };
    media.addEventListener('playing', onPlay);
    media.addEventListener('pause', onPause);
    media.addEventListener('error', onError);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('click', onInteraction);
    document.addEventListener('keydown', onInteraction);
    window.addEventListener('pagehide', pause);
    window.addEventListener('blur', pause);
    window.addEventListener('focus', start);
    return () => {
      request.current++; wanted.current = false;
      media.removeEventListener('playing', onPlay); media.removeEventListener('pause', onPause);
      media.removeEventListener('error', onError);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('click', onInteraction); document.removeEventListener('keydown', onInteraction);
      window.removeEventListener('pagehide', pause); window.removeEventListener('blur', pause);
      window.removeEventListener('focus', start);
      media.pause(); media.removeAttribute('src'); media.load(); audio.current = null;
    };
  }, [pause, start]);

  useEffect(() => {
    wanted.current = preference.ready && preference.enabled;
    if (wanted.current) start();
    else { pause(); setWaitingForTap(false); }
  }, [preference.ready, preference.enabled, pause, start]);

  function toggle() {
    if (!preference.ready) return;
    const next = !preference.enabled;
    wanted.current = next;
    // A manual unmute also plays inside the tap handler for Safari.
    if (next) start(); else pause();
    preference.change(next); setProblem(''); setWaitingForTap(false);
  }
  return { playing, starting, waitingForTap, enabled: preference.enabled, ready: preference.ready,
    problem: problem || preference.problem, toggle };
}
