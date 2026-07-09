'use client';
import { useEffect } from 'react';

/** Register the service worker so Trove installs as a PWA and its shell works offline. */
export default function SWRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
