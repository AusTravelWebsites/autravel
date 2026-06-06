'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { initializeApp, getApps } from 'firebase/app'

const fbCfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}
if (!getApps().length) initializeApp(fbCfg)

const C = { bg:'#f3f4f6', card:'#ffffff', border:'#e5e7eb', text:'#111827', sub:'#6b7280', teal:'#0d9488', tealLight:'#f0fdfa' }

type User = {
  id:string; username:string; display_name:string; avatar_url?:string; bio?:string;
  home_location?: string | null; travel_status?: string | null;
  last_place_name?: string | null; last_country_name?: string | null; last_location_at?: string | null;
  last_seen_at?: string | null; verification_status?: string | null;
}

function isActiveNow(iso?: string | null) {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() < 5 * 60 * 1000
}

function timeAgo(iso?: string | null) {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days < 1) return 'today'
  if (days < 7) return days + 'd ago'
  if (days < 30) return Math.floor(days/7) + 'w ago'
  return Math.floor(days/30) + 'mo ago'
}

function lastLocLabel(u: User) {
  if (u.last_place_name || u.last_country_name) {
    const name = [u.last_place_name, u.last_country_name].filter(Boolean).join(', ')
    return { icon: '📍', text: name, meta: timeAgo(u.last_location_at) }
  }
  if (u.home_location) return { icon: '🏠', text: u.home_location, meta: '' }
  return null
}

export default function FriendsPage() {
  const [me, setMe] = useState<{ username?: string; display_name?: string } | null>(null)
  const [friends, setFriends] = useState<User[]>([])
  const [suggested, setSuggested] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'friends'|'suggested'|'find'|'invite'>('friends')
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const router = useRouter()

  useEffect(() => {
    const auth = getAuth()
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/login'); return }
      const [fRes, sRes, fwRes, meRes] = await Promise.all([
        fetch('/api/follows?mutual=1'),
        fetch('/api/users?suggested=1&limit=20'),
        fetch('/api/follows?me=1'),
        fetch('/api/users?me=1'),
      ])
      const [fData, sData, fwData, meData] = await Promise.all([
        fRes.ok ? fRes.json() : {},
        sRes.ok ? sRes.json() : {},
        fwRes.ok ? fwRes.json() : {},
        meRes.ok ? meRes.json() : {},
      ])
      setFriends(fData.users || [])
      setSuggested(sData.users || [])
      setFollowing(new Set((fwData.following || []).map((f: any) => f.id)))
      setMe(meData.user || null)
      setLoading(false)
    })
    return () => unsub()
  }, [router])

  const toggleFollow = async (userId: string) => {
    const isF = following.has(userId)
    await fetch('/api/follows', { method: isF ? 'DELETE' : 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ following_id: userId }) })
    setFollowing(prev => { const n = new Set(prev); isF ? n.delete(userId) : n.add(userId); return n })
  }

  const rawList = tab === 'friends' ? friends : tab === 'suggested' ? suggested : []
  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rawList
    return rawList.filter(u =>
      (u.display_name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.bio || '').toLowerCase().includes(q) ||
      (u.last_place_name || '').toLowerCase().includes(q) ||
      (u.last_country_name || '').toLowerCase().includes(q) ||
      (u.home_location || '').toLowerCase().includes(q)
    )
  }, [rawList, search])

  return (
    <div style={{ minHeight:'100vh', background:C.bg, color:C.text }}>
      <div style={{ background:C.card, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ maxWidth:680, margin:'0 auto', padding:'16px', display:'flex', alignItems:'center', gap:16 }}>
          <button onClick={() => router.back()} style={{ background:'none', border:'none', cursor:'pointer', color:C.sub, fontSize:14 }}>← Back</button>
          <h1 style={{ fontSize:20, fontWeight:700, color:C.text, margin:0 }}>Friends</h1>
        </div>
      </div>
      <div style={{ maxWidth:680, margin:'0 auto', padding:'20px 16px' }}>

        {/* Tabs */}
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' as const }}>
          {([
            { k:'friends' as const, label:`Friends (${friends.length})` },
            { k:'suggested' as const, label:'Suggested' },
            { k:'find' as const, label:'Find New Friends' },
            { k:'invite' as const, label:'+ Invite' },
          ]).map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{ padding:'8px 18px', borderRadius:99, fontSize:14, fontWeight:600, cursor:'pointer', border:'none', background: tab===t.k?C.teal:C.card, color: tab===t.k?'#fff':C.sub, boxShadow: tab===t.k?'none':`0 0 0 1px ${C.border}` }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Search (not for invite / find tab) */}
        {tab !== 'invite' && tab !== 'find' && (
          <div style={{ position:'relative' as const, marginBottom:16 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position:'absolute' as const, left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' as const }}>
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab==='friends' ? 'Search friends by name, username, or location…' : 'Search travellers…'}
              style={{ width:'100%', padding:'11px 14px 11px 40px', borderRadius:99, border:`1px solid ${C.border}`, fontSize:14, color:C.text, background:C.card, boxSizing:'border-box' as const, outline:'none', fontFamily:'inherit' }}
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear" style={{ position:'absolute' as const, right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:C.sub, cursor:'pointer', fontSize:18, lineHeight:1, padding:6 }}>×</button>
            )}
          </div>
        )}

        {/* Content */}
        {tab === 'invite' ? (
          <InvitePanel me={me} />
        ) : tab === 'find' ? (
          <FindFriendsPanel following={following} onToggleFollow={toggleFollow} />
        ) : loading ? (
          <div style={{ textAlign:'center' as const, padding:40, color:C.sub }}>Loading…</div>
        ) : filteredList.length === 0 ? (
          <div style={{ textAlign:'center' as const, padding:48, background:C.card, borderRadius:16, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:40, marginBottom:12 }}>{search ? '🔍' : (tab==='friends'?'👋':'✨')}</div>
            <div style={{ fontWeight:600, fontSize:16, color:C.text, marginBottom:8 }}>
              {search ? 'No matches' : (tab==='friends'?'No friends yet':'No suggestions right now')}
            </div>
            <div style={{ color:C.sub, fontSize:14 }}>
              {search ? 'Try a different search term.' : (tab==='friends'?'Follow travellers to connect, or invite friends to join.':'Check back soon for new travellers.')}
            </div>
            {!search && tab==='friends' && (
              <div style={{ display:'flex', gap:8, justifyContent:'center' as const, marginTop:16, flexWrap:'wrap' as const }}>
                <button onClick={() => setTab('suggested')} style={{ background:C.teal, color:'#fff', border:'none', borderRadius:99, padding:'10px 20px', fontWeight:600, cursor:'pointer', fontSize:14 }}>Find Travellers</button>
                <button onClick={() => setTab('invite')} style={{ background:C.card, color:C.teal, border:`1px solid ${C.teal}`, borderRadius:99, padding:'10px 20px', fontWeight:600, cursor:'pointer', fontSize:14 }}>Invite friends</button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column' as const, gap:10 }}>
            {filteredList.map(u => {
              const loc = lastLocLabel(u)
              return (
                <div key={u.id} style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, padding:'14px 16px', display:'flex', alignItems:'center', gap:14 }}>
                  <Link href={`/${u.username}`} style={{ flexShrink:0, position:'relative' as const }}>
                    {u.avatar_url
                      ? <img loading="lazy" decoding="async" src={u.avatar_url} alt={u.display_name} style={{ width:50, height:50, borderRadius:'50%', objectFit:'cover' as const }} />
                      : <div style={{ width:50, height:50, borderRadius:'50%', background:C.teal, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:20 }}>{(u.display_name || '?')[0].toUpperCase()}</div>}
                    {isActiveNow(u.last_seen_at) && <span title="Active now" style={{ position:'absolute' as const, bottom:0, right:0, width:14, height:14, background:'#10b981', border:'2px solid #fff', borderRadius:'50%' }}/>}
                  </Link>
                  <div style={{ flex:1, minWidth:0 }}>
                    <Link href={`/${u.username}`} style={{ textDecoration:'none' }}>
                      <div style={{ fontWeight:600, fontSize:15, color:C.text, display:'flex', alignItems:'center', gap:5 }}>
                        {u.display_name}
                        {u.verification_status === 'verified' && <span title="Verified" style={{ color:C.teal, fontSize:12 }}>✓</span>}
                      </div>
                      <div style={{ fontSize:13, color:C.sub }}>@{u.username}</div>
                    </Link>
                    {loc && (
                      <div style={{ fontSize:12, color:C.teal, marginTop:4, display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' as const }}>
                        <span>{loc.icon}</span>
                        <span style={{ fontWeight:600 }}>{loc.text}</span>
                        {loc.meta && <span style={{ color:C.sub, fontWeight:400 }}>· {loc.meta}</span>}
                      </div>
                    )}
                    {u.bio && !loc && <div style={{ fontSize:12, color:C.sub, marginTop:3, overflow:'hidden' as const, whiteSpace:'nowrap' as const, textOverflow:'ellipsis' as const }}>{u.bio}</div>}
                  </div>
                  {tab === 'suggested' ? (
                    <button onClick={() => toggleFollow(u.id)} style={{ background: following.has(u.id) ? C.card : C.teal, color: following.has(u.id) ? C.sub : '#fff', border: `1px solid ${following.has(u.id) ? C.border : C.teal}`, borderRadius:99, padding:'7px 16px', fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' as const }}>
                      {following.has(u.id) ? 'Following' : 'Follow'}
                    </button>
                  ) : (
                    <Link href={`/messages?with=${u.id}`} style={{ background:C.teal, color:'#fff', borderRadius:99, padding:'7px 16px', fontSize:13, fontWeight:600, textDecoration:'none', whiteSpace:'nowrap' as const }}>
                      Message
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Find New Friends Panel ──────────────────────────────────────────────

function FindFriendsPanel({ following, onToggleFollow }: { following: Set<string>; onToggleFollow: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [genders, setGenders] = useState<Set<string>>(new Set())
  const [ageMin, setAgeMin] = useState('')
  const [ageMax, setAgeMax] = useState('')
  const [hasPhotos, setHasPhotos] = useState(true)
  const [sameCountry, setSameCountry] = useState(true)
  const [results, setResults] = useState<User[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [viewerCountry, setViewerCountry] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const toggleGender = (g: string) => {
    setGenders(prev => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n })
  }

  const search = async () => {
    setLoading(true); setErr('')
    try {
      const qs = new URLSearchParams()
      if (q.trim()) qs.set('q', q.trim())
      if (genders.size) qs.set('genders', Array.from(genders).join(','))
      if (ageMin) qs.set('age_min', ageMin)
      if (ageMax) qs.set('age_max', ageMax)
      if (hasPhotos) qs.set('has_photos', '1')
      if (!sameCountry) qs.set('same_country', '0')
      const r = await fetch('/api/users/discover?' + qs.toString())
      const d = await r.json()
      if (!r.ok) { setErr(d?.error || 'Search failed'); setResults([]); return }
      setResults(d.users || [])
      setViewerCountry(d.viewer_country || null)
    } catch { setErr('Network error'); setResults([]) }
    finally { setLoading(false) }
  }

  const chipStyle = (on: boolean): React.CSSProperties => ({
    padding: '7px 14px', borderRadius: 999, border: `1.5px solid ${on ? C.teal : C.border}`, background: on ? C.tealLight : C.card,
    color: on ? C.teal : C.sub, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  })
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }
  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }

  return (
    <div>
      {/* Filter panel */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, marginBottom: 14 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={label}>Search by name, username or city</label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. Sarah, Bali, @traveller…" style={inp} onKeyDown={e => { if (e.key === 'Enter') search() }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Gender (tick one or all)</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            <button type="button" onClick={() => toggleGender('f')} style={chipStyle(genders.has('f'))}>{genders.has('f') ? '✓ ' : ''}Females</button>
            <button type="button" onClick={() => toggleGender('m')} style={chipStyle(genders.has('m'))}>{genders.has('m') ? '✓ ' : ''}Males</button>
            <button type="button" onClick={() => toggleGender('other')} style={chipStyle(genders.has('other'))}>{genders.has('other') ? '✓ ' : ''}Other</button>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Age range</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="number" min="13" max="99" value={ageMin} onChange={e => setAgeMin(e.target.value)} placeholder="From" style={{ ...inp, width: 110 }} />
            <span style={{ color: C.sub }}>—</span>
            <input type="number" min="13" max="99" value={ageMax} onChange={e => setAgeMax(e.target.value)} placeholder="To" style={{ ...inp, width: 110 }} />
            <span style={{ fontSize: 12, color: C.sub }}>(optional)</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: C.text, cursor: 'pointer' }}>
            <input type="checkbox" checked={hasPhotos} onChange={e => setHasPhotos(e.target.checked)} />
            Has photos (show profile picture)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: C.text, cursor: 'pointer' }}>
            <input type="checkbox" checked={sameCountry} onChange={e => setSameCountry(e.target.checked)} />
            Same country as me {viewerCountry ? <span style={{ color: C.sub, fontSize: 12 }}>({viewerCountry})</span> : null}
          </label>
        </div>

        <button onClick={search} disabled={loading} style={{ background: C.teal, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
          {loading ? 'Searching…' : 'Search'}
        </button>
        {err && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 10 }}>{err}</div>}
      </div>

      {/* Results */}
      {results == null ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, textAlign: 'center' as const, color: C.sub }}>
          Set your filters above and hit Search.
        </div>
      ) : results.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, textAlign: 'center' as const, color: C.sub }}>
          No travellers match your filters. Try loosening them.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          <div style={{ fontSize: 12, color: C.sub, paddingLeft: 4 }}>{results.length} traveller{results.length === 1 ? '' : 's'}</div>
          {results.map(u => {
            const loc = lastLocLabel(u)
            const age = (u as any).age
            return (
              <div key={u.id} style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <Link href={`/${u.username}`} style={{ flexShrink: 0, position: 'relative' as const }}>
                  {u.avatar_url
                    ? <img loading="lazy" decoding="async" src={u.avatar_url} alt={u.display_name} style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover' as const }} />
                    : <div style={{ width: 54, height: 54, borderRadius: '50%', background: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 22 }}>{(u.display_name || '?')[0].toUpperCase()}</div>}
                  {isActiveNow(u.last_seen_at) && <span title="Active now" style={{ position: 'absolute' as const, bottom: 0, right: 0, width: 14, height: 14, background: '#10b981', border: '2px solid #fff', borderRadius: '50%' }}/>}
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/${u.username}`} style={{ textDecoration: 'none' }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: C.text, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                      {u.display_name}
                      {u.verification_status === 'verified' && <span title="Verified" style={{ color: C.teal, fontSize: 12 }}>✓</span>}
                      {age != null && <span style={{ color: C.sub, fontWeight: 400 }}>· {age}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: C.sub }}>@{u.username}</div>
                  </Link>
                  {loc && <div style={{ fontSize: 12, color: C.teal, marginTop: 4 }}>{loc.icon} <span style={{ fontWeight: 600 }}>{loc.text}</span></div>}
                  {u.bio && !loc && <div style={{ fontSize: 12, color: C.sub, marginTop: 3, overflow: 'hidden' as const, whiteSpace: 'nowrap' as const, textOverflow: 'ellipsis' as const }}>{u.bio}</div>}
                </div>
                <button onClick={() => onToggleFollow(u.id)} style={{ background: following.has(u.id) ? C.card : C.teal, color: following.has(u.id) ? C.sub : '#fff', border: `1px solid ${following.has(u.id) ? C.border : C.teal}`, borderRadius: 99, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                  {following.has(u.id) ? 'Following' : 'Follow'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Invite Panel ─────────────────────────────────────────────────────────

function InvitePanel({ me }: { me: { username?: string; display_name?: string } | null }) {
  const [emails, setEmails] = useState('')
  const [status, setStatus] = useState<'idle'|'sending'|'done'|'error'>('idle')
  const [sentCount, setSentCount] = useState(0)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)

  const ref = me?.username || ''
  const inviteUrl = `https://bugbitten.com/signup${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`
  const shareText = `Join me on BugBitten — the GPS-verified travel journal. Come along: ${inviteUrl}`

  const parseEmails = (s: string) =>
    s.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean).filter(x => /.+@.+\..+/.test(x))

  const sendEmails = async () => {
    const list = parseEmails(emails)
    if (list.length === 0) { setErr('Please enter at least one valid email.'); return }
    setStatus('sending'); setErr('')
    try {
      const r = await fetch('/api/invites', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ emails: list, context: 'friends' }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Failed to send invites')
      setSentCount(list.length)
      setStatus('done')
      setEmails('')
    } catch (e: any) {
      setStatus('error'); setErr(e.message || 'Failed to send invites')
    }
  }

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }

  const openShare = (url: string) => window.open(url, '_blank', 'noopener,width=600,height=500')

  const shareUrls = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteUrl)}`,
    messenger: `https://www.facebook.com/dialog/send?link=${encodeURIComponent(inviteUrl)}&app_id=140586622674265&redirect_uri=${encodeURIComponent(inviteUrl)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
    sms: `sms:?body=${encodeURIComponent(shareText)}`,
    email: `mailto:?subject=${encodeURIComponent('Join me on BugBitten')}&body=${encodeURIComponent(shareText)}`,
  }

  const btn: React.CSSProperties = { display:'inline-flex', alignItems:'center', justifyContent:'center' as const, gap:8, padding:'12px 14px', borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', border:`1px solid ${C.border}`, background:'#fff', color:C.text, textDecoration:'none', fontFamily:'inherit' }

  return (
    <div>
      <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:22, marginBottom:16 }}>
        <h2 style={{ fontSize:17, fontWeight:700, color:C.text, margin:'0 0 6px' }}>Invite by email</h2>
        <p style={{ fontSize:13, color:C.sub, margin:'0 0 14px', lineHeight:1.5 }}>Add one or more email addresses (comma or newline separated). We'll send each person a friendly invitation from you.</p>
        <textarea
          value={emails}
          onChange={e => setEmails(e.target.value)}
          placeholder="friend@example.com, another@example.com"
          rows={3}
          style={{ width:'100%', padding:'11px 14px', borderRadius:10, border:`1px solid ${C.border}`, fontSize:14, color:C.text, background:'#fff', boxSizing:'border-box' as const, outline:'none', fontFamily:'inherit', resize:'vertical' as const, lineHeight:1.5 }}
        />
        {err && <div style={{ color:'#ef4444', fontSize:13, marginTop:8 }}>{err}</div>}
        {status === 'done' && <div style={{ color:C.teal, fontSize:13, marginTop:8, fontWeight:600 }}>✓ Invitation{sentCount > 1 ? 's' : ''} sent to {sentCount} {sentCount > 1 ? 'people' : 'person'}.</div>}
        <button onClick={sendEmails} disabled={status === 'sending'} style={{ marginTop:12, background: status==='sending' ? C.sub : C.teal, color:'#fff', border:'none', borderRadius:10, padding:'11px 22px', fontSize:14, fontWeight:700, cursor: status==='sending' ? 'wait' : 'pointer', fontFamily:'inherit' }}>
          {status === 'sending' ? 'Sending…' : 'Send invitations'}
        </button>
      </div>

      <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:22, marginBottom:16 }}>
        <h2 style={{ fontSize:17, fontWeight:700, color:C.text, margin:'0 0 6px' }}>Share on social</h2>
        <p style={{ fontSize:13, color:C.sub, margin:'0 0 14px', lineHeight:1.5 }}>Share your personal invite link on Facebook, Messenger, WhatsApp, X, SMS, or email.</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:10 }}>
          <a onClick={e => { e.preventDefault(); openShare(shareUrls.facebook) }} href={shareUrls.facebook} style={{ ...btn, background:'#1877F2', color:'#fff', borderColor:'#1877F2' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Facebook
          </a>
          <a onClick={e => { e.preventDefault(); openShare(shareUrls.messenger) }} href={shareUrls.messenger} style={{ ...btn, background:'#0084FF', color:'#fff', borderColor:'#0084FF' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.498 1.744 6.614 4.471 8.652V24l4.088-2.242c1.092.3 2.246.464 3.441.464 6.627 0 12-4.974 12-11.11C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.26L19.752 8l-6.561 6.963z"/></svg>
            Messenger
          </a>
          <a onClick={e => { e.preventDefault(); openShare(shareUrls.whatsapp) }} href={shareUrls.whatsapp} style={{ ...btn, background:'#25D366', color:'#fff', borderColor:'#25D366' }}>
            💬 WhatsApp
          </a>
          <a onClick={e => { e.preventDefault(); openShare(shareUrls.x) }} href={shareUrls.x} style={{ ...btn, background:'#000', color:'#fff', borderColor:'#000' }}>
            𝕏  Post on X
          </a>
          <a href={shareUrls.sms} style={btn}>✉️ SMS</a>
          <a href={shareUrls.email} style={btn}>📧 Email</a>
        </div>
      </div>

      <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.border}`, padding:22 }}>
        <h2 style={{ fontSize:17, fontWeight:700, color:C.text, margin:'0 0 6px' }}>Your personal invite link</h2>
        <p style={{ fontSize:13, color:C.sub, margin:'0 0 14px', lineHeight:1.5 }}>Anyone who signs up via this link will be connected to you on BugBitten.</p>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' as const }}>
          <input readOnly value={inviteUrl} style={{ flex:'1 1 260px', padding:'11px 14px', borderRadius:10, border:`1px solid ${C.border}`, fontSize:13, color:C.text, background:'#f9fafb', boxSizing:'border-box' as const, outline:'none', fontFamily:'monospace', minWidth:0 }} onFocus={e => e.currentTarget.select()} />
          <button onClick={copyLink} style={{ background:copied?'#10b981':C.teal, color:'#fff', border:'none', borderRadius:10, padding:'11px 22px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
        </div>
      </div>
    </div>
  )
}
