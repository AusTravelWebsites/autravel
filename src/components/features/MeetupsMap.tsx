'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const C = { card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: 'var(--brand)' };

interface Meetup {
  id: string;
  slug?: string;
  title: string;
  location_name: string | null;
  meetup_date: string;
  lat: number | null;
  lng: number | null;
  cover_image?: string | null;
  attendee_count?: number;
  category?: string | null;
}

function loadLeaflet(): Promise<any> {
  if ((window as any).L) return Promise.resolve((window as any).L);
  return new Promise((resolve, reject) => {
    // CSS
    if (!document.querySelector('link[data-leaflet]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.setAttribute('data-leaflet', '');
      document.head.appendChild(link);
    }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.async = true;
    s.onload = () => resolve((window as any).L);
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

export function MeetupsMap({ meetups }: { meetups: Meetup[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!ref.current) return;
    const withCoords = meetups.filter(m => m.lat != null && m.lng != null);
    if (withCoords.length === 0) return;

    let map: any;
    loadLeaflet().then(L => {
      map = L.map(ref.current).setView([withCoords[0].lat!, withCoords[0].lng!], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18, attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const group: any[] = [];
      withCoords.forEach(m => {
        const href = `/meetups/${m.id}`;
        const date = new Date(m.meetup_date).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
        const html = `<div style="font-family:system-ui,sans-serif;min-width:180px">
          <a href="${href}" style="color:var(--brand);font-weight:700;font-size:13px;text-decoration:none">${escape(m.title)}</a>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">${escape(m.location_name || '')}</div>
          <div style="font-size:11px;color:#6b7280">📅 ${date}</div>
          ${m.attendee_count != null ? `<div style="font-size:11px;color:#6b7280">👥 ${m.attendee_count} going</div>` : ''}
        </div>`;
        const marker = L.marker([m.lat!, m.lng!]).addTo(map).bindPopup(html);
        group.push(marker);
      });

      if (group.length > 1) {
        const featureGroup = L.featureGroup(group);
        map.fitBounds(featureGroup.getBounds().pad(0.2));
      } else if (group.length === 1) {
        map.setView([withCoords[0].lat!, withCoords[0].lng!], 10);
      }
    }).catch(() => setErr('Map failed to load'));

    return () => { if (map) map.remove(); };
  }, [meetups]);

  const withCoords = meetups.filter(m => m.lat != null && m.lng != null);
  if (withCoords.length === 0) {
    return <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28, textAlign: 'center' as const, color: C.sub, fontSize: 14 }}>No mappable meetups yet.</div>;
  }

  return (
    <div style={{ position: 'relative' as const, height: 420, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' as const }}>
      <div ref={ref} style={{ height: '100%', width: '100%' }} />
      {err && <div style={{ position: 'absolute' as const, top: 8, left: 8, color: '#ef4444', fontSize: 12 }}>{err}</div>}
    </div>
  );
}

function escape(s: string) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
