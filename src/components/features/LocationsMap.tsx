'use client';
import { useEffect, useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Map "ISO_A2" property from the topojson — react-simple-maps exposes properties.iso_a2
// world-atlas v2 uses numeric ids; we fall back to name match when available.
// To support both: we accept a Set of country names (uppercase) AND iso codes.

interface Props {
  visited: Set<string>;       // uppercase country names + ISO codes
  onCountryClick?: (info: { name: string; code: string }) => void;
  selectedCode?: string | null;
}

export function LocationsMap({ visited, onCountryClick, selectedCode }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const isVisited = (geo: any): boolean => {
    const name = (geo.properties?.name || '').toUpperCase();
    const a2 = (geo.properties?.iso_a2 || geo.properties?.['ISO_A2'] || '').toUpperCase();
    const a3 = (geo.properties?.iso_a3 || '').toUpperCase();
    return visited.has(name) || (!!a2 && visited.has(a2)) || (!!a3 && visited.has(a3));
  };

  return (
    <div style={{ background: 'var(--brand-light)', border: '1px solid #99f6e4', borderRadius: 16, padding: 12, position: 'relative' as const }}>
      <ComposableMap projection="geoMercator" projectionConfig={{ scale: 130 }} style={{ width: '100%', height: 'auto' }}>
        <ZoomableGroup center={[10, 10]} zoom={1}>
          <Geographies geography={GEO_URL}>
            {({ geographies }: any) =>
              geographies.map((geo: any) => {
                const visited = isVisited(geo);
                const name = geo.properties?.name || 'Unknown';
                const code = (geo.properties?.iso_a2 || geo.properties?.['ISO_A2'] || name.slice(0, 2).toUpperCase()) as string;
                const isSelected = selectedCode && (code === selectedCode || name.toUpperCase() === selectedCode.toUpperCase());
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => onCountryClick?.({ name, code })}
                    onMouseEnter={() => setHovered(name)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      default: {
                        fill: visited ? 'var(--brand)' : '#e5e7eb',
                        stroke: '#fff', strokeWidth: 0.5, outline: 'none',
                        cursor: 'pointer',
                      },
                      hover: {
                        fill: visited ? 'var(--brand-dark)' : '#94a3b8',
                        stroke: '#fff', strokeWidth: 0.5, outline: 'none',
                        cursor: 'pointer',
                      },
                      pressed: {
                        fill: 'var(--brand-dark)', stroke: '#fff', strokeWidth: 0.5, outline: 'none',
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
      {hovered && (
        <div style={{ position: 'absolute' as const, top: 12, left: 16, background: 'rgba(17,24,39,0.85)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, pointerEvents: 'none' as const }}>
          {hovered}
        </div>
      )}
      <div style={{ position: 'absolute' as const, bottom: 12, right: 16, display: 'flex', gap: 12, fontSize: 12, color: '#6b7280', background: 'rgba(255,255,255,0.85)', padding: '4px 10px', borderRadius: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--brand)' }} /> Visited
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#e5e7eb' }} /> Click to add
        </span>
      </div>
    </div>
  );
}
