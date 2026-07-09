'use client';
/* Hold-to-talk capture. Uses the browser's on-device SpeechRecognition (real speech-to-text, no
   key) for the live "just let them talk" experience — elders talk, they don't type. The Qwen ASR
   cloud path (/api/troves/[id]/asr) is wired behind the env seam for server-side transcription of
   uploaded audio; this on-device path means spoken input works immediately, everywhere it's
   supported (Chrome / Edge / Safari). Falls back to typing where unsupported. */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useSpeech(onFinal?: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef<any>(null);
  const finalRef = useRef<(t: string) => void>(() => {});
  finalRef.current = onFinal || (() => {});

  useEffect(() => {
    const SR = (typeof window !== 'undefined') && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) return;
    setSupported(true);
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (e: any) => {
      let interimText = '';
      let finalText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (interimText) setInterim(interimText);
      if (finalText) { finalRef.current(finalText.trim()); setInterim(''); }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
  }, []);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    try { rec.start(); setListening(true); setInterim(''); } catch {}
  }, []);
  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    try { rec.stop(); } catch {}
    setListening(false);
  }, []);

  return { supported, listening, interim, start, stop };
}
