'use client';
import { useEffect, useRef, useState } from 'react';

// Loads Leaflet from unpkg (CSP-allowed: script-src/style-src include unpkg.com,
// img-src includes *.tile.openstreetmap.org) and draws a trail's route geometry
// as polyline(s) over an OSM base map. Geometry is an array of segments, each a
// list of [lat, lng] pairs (see the `trails.geometry` column).
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
    if ((window as any).__leafletLoading) {
      const iv = setInterval(() => { if ((window as any).L) { clearInterval(iv); resolve((window as any).L); } }, 60);
      return;
    }
    (window as any).__leafletLoading = true;
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.async = true;
    s.onload = () => resolve((window as any).L);
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

type Seg = [number, number][];

export function TrailMap({
  geometry,
  start,
  color = 'var(--brand)',
  height = 460,
  interactive = true,
  rounded = 12,
}: {
  geometry: Seg[];
  start?: [number, number] | null;
  color?: string;
  height?: number;
  interactive?: boolean;
  rounded?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!ref.current || !geometry?.length) return;
    let map: any;
    loadLeaflet().then(L => {
      if (!ref.current) return;
      map = L.map(ref.current, {
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: false,
        doubleClickZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
        touchZoom: interactive,
        attributionControl: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18, attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const lines: any[] = [];
      for (const seg of geometry) {
        if (!seg?.length) continue;
        // halo + line for legibility over the basemap
        L.polyline(seg, { color: '#ffffff', weight: 7, opacity: 0.9 }).addTo(map);
        lines.push(L.polyline(seg, { color, weight: 4, opacity: 1 }).addTo(map));
      }
      if (start) {
        L.circleMarker(start, { radius: 7, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 })
          .addTo(map).bindPopup('Start');
      }
      const group = L.featureGroup(lines.length ? lines : []);
      try { map.fitBounds(group.getBounds().pad(0.15)); }
      catch { if (start) map.setView(start, 13); }
      setTimeout(() => map.invalidateSize(), 150);
    }).catch(() => setErr('Map failed to load'));

    return () => { if (map) map.remove(); };
  }, [geometry, start, color, interactive]);

  if (!geometry?.length) {
    return (
      <div style={{ height, borderRadius: rounded, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
        Route map unavailable
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', height, borderRadius: rounded, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      <div ref={ref} style={{ height: '100%', width: '100%' }} />
      {err && <div style={{ position: 'absolute', top: 8, left: 8, color: '#ef4444', fontSize: 12, background: '#fff', padding: '2px 6px', borderRadius: 4 }}>{err}</div>}
    </div>
  );
}
