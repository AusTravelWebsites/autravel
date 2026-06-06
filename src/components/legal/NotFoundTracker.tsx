'use client';
import { useEffect } from 'react';

export function NotFoundTracker() {
  useEffect(() => {
    try {
      const path = window.location.pathname + window.location.search;
      const referrer = document.referrer || null;
      fetch('/api/track/404/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ path, referrer }),
      }).catch(() => {});
    } catch {}
  }, []);
  return null;
}
