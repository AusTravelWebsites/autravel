'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MeetupsMap } from '@/components/features/MeetupsMap';

interface Meetup {
  id: string;
  title: string;
  description: string | null;
  location_name: string | null;
  meetup_date: string;
  max_attendees: number;
  is_public: boolean;
  host_id: string;
  host_username: string | null;
  host_display_name: string | null;
  host_avatar_url: string | null;
  host_verified?: string | null;
  host_rating?: number | null;
  host_rating_count?: number | null;
  category?: string | null;
  scope?: string | null;
  cover_image?: string | null;
  women_only?: boolean;
  attendee_count: number;
  is_attending: boolean;
  is_host?: boolean;
  created_at: string;
  lat?: number | null;
  lng?: number | null;
}

export default function MeetupsPage() {
  const router = useRouter();
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [loading, setLoading] = useState(true);
  const [attending, setAttending] = useState<string | null>(null);
  const [tab, setTab] = useState<'upcoming'|'mine'>('upcoming');
  const [category, setCategory] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ filter: tab });
    if (category) qs.set('category', category);
    if (verifiedOnly) qs.set('verified', '1');
    fetch('/api/meetups?' + qs.toString())
      .then(r => r.json())
      .then(d => { setMeetups(d.meetups || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tab, category, verifiedOnly]);

  const toggleAttend = async (meetup: Meetup) => {
    setAttending(meetup.id);
    const method = meetup.is_attending ? 'DELETE' : 'POST';
    await fetch(`/api/meetups/${meetup.id}/attend`, { method });
    setMeetups(prev => prev.map(m => m.id === meetup.id
      ? { ...m, is_attending: !m.is_attending, attendee_count: m.attendee_count + (m.is_attending ? -1 : 1) }
      : m
    ));
    setAttending(null);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const isUpcoming = (dateStr: string) => new Date(dateStr) > new Date();

  const tabStyle = (active: boolean) => ({
    padding: '8px 20px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
    background: active ? '#0d9488' : '#fff',
    color: active ? '#fff' : '#6b7280',
    border: active ? 'none' : '1px solid #e5e7eb',
  } as React.CSSProperties);

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 800, color: '#111827', margin: 0 }}>Meetups</h1>
            <p style={{ color: '#6b7280', marginTop: '6px', fontSize: '14px' }}>Meet fellow travellers in real life</p>
          </div>
          <button
            onClick={() => router.push('/meetups/new')}
            style={{ background: '#0d9488', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            + Create Meetup
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' as const }}>
          <button style={tabStyle(tab === 'upcoming')} onClick={() => setTab('upcoming')}>Upcoming</button>
          <button style={tabStyle(tab === 'mine')} onClick={() => setTab('mine')}>My Meetups</button>
        </div>

        {/* Trending — pinned most-attended upcoming meetups, only on Upcoming + no filters */}
        {tab === 'upcoming' && !loading && !category && !verifiedOnly && view === 'list' && meetups.length > 0 && (() => {
          const trending = [...meetups]
            .filter(m => isUpcoming(m.meetup_date) && m.attendee_count >= 2)
            .sort((a, b) => b.attendee_count - a.attendee_count)
            .slice(0, 3);
          if (trending.length === 0) return null;
          return (
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8 }}>🔥 Trending now</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {trending.map(m => (
                  <div key={m.id} onClick={() => router.push(`/meetups/${m.id}`)}
                    style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 12, padding: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', display: '-webkit-box' as any, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' as const }}>{m.title}</div>
                    <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600 }}>👥 {m.attendee_count} going · {formatDate(m.meetup_date)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {tab === 'upcoming' && (
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 20, alignItems: 'center' }}>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ padding: '7px 12px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, color: '#374151', cursor: 'pointer' }}>
              <option value="">All categories</option>
              <option value="food">🍽️ Food & drinks</option>
              <option value="hiking">🥾 Hiking & outdoors</option>
              <option value="nightlife">🌃 Nightlife</option>
              <option value="culture">🏛️ Culture</option>
              <option value="adventure">🚀 Adventure</option>
              <option value="wellness">🧘 Wellness</option>
              <option value="tour">🗺️ Tour</option>
              <option value="other">✨ Other</option>
            </select>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 999, border: `1px solid ${verifiedOnly ? '#0d9488' : '#e5e7eb'}`, background: verifiedOnly ? '#f0fdfa' : '#fff', color: verifiedOnly ? '#0d9488' : '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} style={{ margin: 0 }} />
              ✓ Verified hosts only
            </label>
            {(category || verifiedOnly) && (
              <button onClick={() => { setCategory(''); setVerifiedOnly(false); }}
                style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                Clear filters
              </button>
            )}
            <div style={{ marginLeft: 'auto', display: 'inline-flex', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 999, padding: 2 }}>
              {(['list','map'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  style={{ border: 'none', borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: view === v ? '#0d9488' : 'transparent', color: view === v ? '#fff' : '#6b7280', fontFamily: 'inherit' }}>
                  {v === 'list' ? 'List' : 'Map'}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'upcoming' && view === 'map' && !loading && (
          <div style={{ marginBottom: 20 }}>
            <MeetupsMap meetups={meetups.map(m => ({ id: m.id, title: m.title, location_name: m.location_name, meetup_date: m.meetup_date, lat: m.lat ?? null, lng: m.lng ?? null, attendee_count: m.attendee_count, category: m.category, cover_image: m.cover_image }))} />
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>Loading meetups...</div>
        )}

        {!loading && meetups.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px', background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤝</div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>No meetups yet</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
              {tab === 'mine' ? "You haven't created or joined any meetups" : "No upcoming meetups in your area"}
            </p>
            <button
              onClick={() => router.push('/meetups/new')}
              style={{ background: '#0d9488', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >
              Create First Meetup
            </button>
          </div>
        )}

        {!loading && meetups.length > 0 && tab === 'mine' && view === 'list' && (
          <>
            {(['Hosting','Attending'] as const).map(title => {
              const items = meetups.filter(m => title === 'Hosting' ? m.is_host : !m.is_host);
              if (items.length === 0) return null;
              return (
                <div key={title} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '4px 0 8px' }}>{title} ({items.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
                    {items.map(m => <div key={m.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }} onClick={() => router.push(`/meetups/${m.id}`)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{m.title}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
                          <span>📅 {formatDate(m.meetup_date)}</span>
                          {m.location_name && <span>📍 {m.location_name}</span>}
                          <span>👥 {m.attendee_count}/{m.max_attendees}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: title === 'Hosting' ? '#0d9488' : '#374151', background: title === 'Hosting' ? '#f0fdfa' : '#f3f4f6', padding: '4px 10px', borderRadius: 99 }}>
                        {title === 'Hosting' ? 'You host' : 'You\u2019re going'}
                      </span>
                    </div>)}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {!loading && meetups.length > 0 && tab !== 'mine' && view === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {meetups.map(meetup => {
              const upcoming = isUpcoming(meetup.meetup_date);
              const full = meetup.attendee_count >= meetup.max_attendees;
              return (
                <div key={meetup.id} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', opacity: upcoming ? 1 : 0.7, overflow: 'hidden' as const }}>
                  {meetup.cover_image && (
                    <div onClick={() => router.push(`/meetups/${meetup.id}`)} style={{ height: 140, background: `url(${meetup.cover_image}) center/cover no-repeat, #e5e7eb`, cursor: 'pointer' }} />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', padding: 20 }}>
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => router.push(`/meetups/${meetup.id}`)}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 8 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: upcoming ? '#f0fdfa' : '#f3f4f6', color: upcoming ? '#0d9488' : '#6b7280', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 600 }}>
                          📅 {formatDate(meetup.meetup_date)}
                          {!upcoming && <span style={{ marginLeft: '4px', color: '#9ca3af' }}>· Past</span>}
                        </span>
                        {meetup.category && <span style={{ background: '#f3f4f6', color: '#374151', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{meetup.category}</span>}
                        {meetup.women_only && <span style={{ background: '#fce7f3', color: '#9d174d', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>Women only</span>}
                      </div>
                      <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 700, color: '#111827' }}>{meetup.title}</h3>
                      {meetup.description && (
                        <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>{meetup.description.slice(0, 140)}{meetup.description.length > 140 ? '…' : ''}</p>
                      )}
                      <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#6b7280', flexWrap: 'wrap' as const }}>
                        {meetup.location_name && <span>📍 {meetup.location_name}</span>}
                        <span>👥 {meetup.attendee_count}/{meetup.max_attendees} going</span>
                      </div>
                      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e5e7eb', overflow: 'hidden', flexShrink: 0 }}>
                          {meetup.host_avatar_url && <img loading="lazy" decoding="async" src={meetup.host_avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        </div>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                          Hosted by <strong style={{ color: '#374151' }}>{meetup.host_display_name || meetup.host_username || 'Traveller'}</strong>
                        </span>
                        {meetup.host_verified === 'verified' && <span title="Verified" style={{ color: '#0d9488', fontSize: 11, fontWeight: 700 }}>✓</span>}
                        {meetup.host_rating != null && <span style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', borderRadius: 999, padding: '1px 7px', fontWeight: 600 }}>★{Number(meetup.host_rating).toFixed(1)}</span>}
                      </div>
                    </div>
                    {/* RSVP button */}
                    {upcoming && (
                      <button
                        onClick={() => toggleAttend(meetup)}
                        disabled={attending === meetup.id || (full && !meetup.is_attending)}
                        style={{
                          flexShrink: 0, border: 'none', borderRadius: '10px', padding: '10px 18px',
                          fontSize: '13px', fontWeight: 600, cursor: (full && !meetup.is_attending) ? 'not-allowed' : 'pointer',
                          background: meetup.is_attending ? '#fef2f2' : full ? '#f3f4f6' : '#0d9488',
                          color: meetup.is_attending ? '#ef4444' : full ? '#9ca3af' : '#fff',
                          opacity: attending === meetup.id ? 0.6 : 1,
                          minWidth: '90px',
                        }}
                      >
                        {attending === meetup.id ? '...' : meetup.is_attending ? 'Leave' : full ? 'Full' : "I'm going"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
