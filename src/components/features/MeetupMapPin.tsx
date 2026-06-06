'use client';
import { useEffect, useRef } from 'react';

function loadLeaflet(): Promise<any> {
  if ((window as any).L) return Promise.resolve((window as any).L);
  return new Promise((resolve, reject) => {
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

export function MeetupMapPin({ lat, lng, label }: { lat: number; lng: number; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || lat == null || lng == null) return;
    let map: any;
    loadLeaflet().then(L => {
      map = L.map(ref.current, { scrollWheelZoom: false }).setView([lat, lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18, attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      L.marker([lat, lng]).addTo(map).bindPopup(label || 'Meetup location');
    });
    return () => { if (map) map.remove(); };
  }, [lat, lng, label]);

  if (lat == null || lng == null) return null;
  return <div ref={ref} style={{ height: 220, background: '#e5e7eb', borderRadius: 12, overflow: 'hidden' as const, border: '1px solid #e5e7eb', marginBottom: 16 }} />;
}
