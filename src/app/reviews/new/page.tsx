'use client'
import { Suspense } from 'react'

import {
  useState, useRef, useCallback, useEffect,
  type ChangeEvent, type FormEvent,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ensureLocation } from '@/lib/ensureLocation'
import { PlaceAutocomplete } from '@/components/features/PlaceAutocomplete'

// ─── Types ────────────────────────────────────────────────────────────────────

type PlaceCategory = 'hostel' | 'hotel' | 'attraction' | 'food' | 'nature' | 'nightlife'
type TravellerType = 'solo' | 'couple' | 'group' | 'family'
type Step = 1 | 2 | 3

interface SubRating {
  key:   string
  label: string
  icon:  string
  hint:  string
}

interface Place {
  id:       string
  name:     string
  city:     string
  country:  string
  category: PlaceCategory
  address:  string
}

interface PhotoFile {
  id:        string
  file:      File
  preview:   string
  uploading: boolean
  url?:      string
}

interface Recommendation {
  id:    string
  name:  string
  query: string
}

interface TaggedUser { id: string; username: string; display_name: string; avatar_url?: string | null }

interface FormData {
  overallRating:    number
  subRatings:       Record<string, number>
  nightsStayed:     number
  travellerType:    TravellerType | ''
  visitDate:        string
  body:             string
  photos:           PhotoFile[]
  recommendations:  Recommendation[]
  taggedUsers:      TaggedUser[]
  inviteEmails:     string[]
}

// ─── Sub-rating definitions by category ───────────────────────────────────────

const SUB_RATINGS: Record<PlaceCategory, SubRating[]> = {
  hostel: [
    { key: 'cleanliness', label: 'Cleanliness',  icon: '✨', hint: 'Bathrooms, dorms, common areas' },
    { key: 'social_vibe', label: 'Social vibe',  icon: '🫂', hint: 'How easy was it to meet people?' },
    { key: 'value',       label: 'Value',        icon: '💰', hint: 'Price vs. quality' },
    { key: 'staff',       label: 'Staff',        icon: '⭐', hint: 'Helpfulness and friendliness' },
  ],
  hotel: [
    { key: 'cleanliness', label: 'Cleanliness', icon: '✨', hint: 'Room and facilities' },
    { key: 'comfort',     label: 'Comfort',     icon: '🛏', hint: 'Beds, noise, temperature' },
    { key: 'value',       label: 'Value',       icon: '💰', hint: 'Price vs. quality' },
    { key: 'staff',       label: 'Staff',       icon: '⭐', hint: 'Service quality' },
  ],
  attraction: [
    { key: 'experience',    label: 'Experience',    icon: '🌟', hint: 'Was it worth the visit?' },
    { key: 'crowd_level',   label: 'Crowd level',   icon: '👥', hint: 'How busy was it?' },
    { key: 'accessibility', label: 'Accessibility', icon: '♿', hint: 'Easy to reach and navigate?' },
    { key: 'value',         label: 'Value',         icon: '💰', hint: 'Entry fees vs. experience' },
  ],
  food: [
    { key: 'food_quality', label: 'Food quality', icon: '🍴', hint: 'Taste and freshness' },
    { key: 'service',      label: 'Service',      icon: '⭐', hint: 'Speed and attentiveness' },
    { key: 'ambience',     label: 'Ambience',     icon: '🌿', hint: 'Atmosphere and setting' },
    { key: 'value',        label: 'Value',        icon: '💰', hint: 'Price vs. quality' },
  ],
  nature: [
    { key: 'experience',  label: 'Experience',  icon: '🌟', hint: 'Overall impression' },
    { key: 'access',      label: 'Access',      icon: '🥾', hint: 'Getting there and trails' },
    { key: 'safety',      label: 'Safety',      icon: '🛡', hint: 'Conditions and signage' },
    { key: 'crowd_level', label: 'Crowd level', icon: '👥', hint: 'How busy was it?' },
  ],
  nightlife: [
    { key: 'atmosphere', label: 'Atmosphere', icon: '🔥', hint: 'Energy and vibe' },
    { key: 'music',      label: 'Music',      icon: '🎵', hint: 'Quality and volume' },
    { key: 'value',      label: 'Value',      icon: '💰', hint: 'Drink prices and entry' },
    { key: 'crowd',      label: 'Crowd',      icon: '🫂', hint: 'Who goes there?' },
  ],
}

const SHOWS_NIGHTS: PlaceCategory[] = ['hostel', 'hotel']
const MIN_WORDS = 50

// ─── Mock place (replace with real fetch from searchParams placeId) ───────────

const MOCK_PLACE: Place = {
  id:       'pl_01',
  name:     'The Green Monkey Hostel',
  city:     'Ubud',
  country:  'Indonesia',
  category: 'hostel',
  address:  'Jl. Bisma No.27, Ubud, Bali',
}

// ─── Main component ───────────────────────────────────────────────────────────

function ReviewFormPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const placeId      = searchParams.get('place')

  const [place, setPlace] = useState<Place | null>(null)
  useEffect(() => {
    if (!placeId) return
    fetch(`/api/places?slug=${encodeURIComponent(placeId)}&id=${encodeURIComponent(placeId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const p = d?.place
        if (!p) return
        const cat = (p.category as string) || 'attraction'
        const mapped: PlaceCategory = (['hostel','hotel','attraction','food','nature','nightlife'].includes(cat) ? cat : 'attraction') as PlaceCategory
        setPlace({ id: p.id, name: p.name, city: p.city || '', country: p.country || '', category: mapped, address: p.address || '' })
      }).catch(() => {})
  }, [placeId])
  const checkInValid = true

  const [step, setStep] = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const subRatingDefs = SUB_RATINGS[place.category] ?? SUB_RATINGS.attraction

  const [form, setForm] = useState<FormData>({
    overallRating:   0,
    subRatings:      Object.fromEntries(subRatingDefs.map(r => [r.key, 0])),
    nightsStayed:    1,
    travellerType:   '',
    visitDate:       new Date().toISOString().slice(0, 10),
    body:            '',
    photos:          [],
    recommendations: [],
    taggedUsers:     [],
    inviteEmails:    [],
  })

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const wordCount = form.body.trim().split(/\s+/).filter(Boolean).length
  const wordsLeft = Math.max(0, MIN_WORDS - wordCount)

  function setOverall(n: number) {
    setForm(f => ({ ...f, overallRating: n }))
  }

  function setSubRating(key: string, val: number) {
    setForm(f => ({ ...f, subRatings: { ...f.subRatings, [key]: val } }))
  }

  function canAdvanceStep1() {
    return form.overallRating > 0 && form.travellerType !== ''
  }

  function canAdvanceStep2() {
    const allSet = subRatingDefs.every(r => form.subRatings[r.key] > 0)
    return allSet
  }

  function canSubmit() {
    return wordCount >= MIN_WORDS
  }

  // ── Photo handling ────────────────────────────────────────────────────────────

  const fileRef = useRef<HTMLInputElement>(null)

  function handlePhotoSelect(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return
    const files = Array.from(e.target.files).slice(0, 8 - form.photos.length)
    const newPhotos: PhotoFile[] = files.map(f => ({
      id:        Math.random().toString(36).slice(2),
      file:      f,
      preview:   URL.createObjectURL(f),
      uploading: false,
    }))
    setForm(f => ({ ...f, photos: [...f.photos, ...newPhotos] }))
    e.target.value = ''
  }

  function removePhoto(id: string) {
    setForm(f => {
      const photo = f.photos.find(p => p.id === id)
      if (photo) URL.revokeObjectURL(photo.preview)
      return { ...f, photos: f.photos.filter(p => p.id !== id) }
    })
  }

  // ── Recommendation handling ───────────────────────────────────────────────────

  const [recQuery, setRecQuery]   = useState('')
  const [recResults, setRecResults] = useState<Recommendation[]>([])

  // Debounced Google Places autocomplete stub
  useEffect(() => {
    if (recQuery.length < 3) { setRecResults([]); return }
    const t = setTimeout(() => {
      // Replace with real Google Places autocomplete call
      setRecResults([
        { id: 'r1', name: 'Campuhan Ridge Walk', query: recQuery },
        { id: 'r2', name: 'Tegallalang Rice Terraces', query: recQuery },
        { id: 'r3', name: 'Sacred Monkey Forest', query: recQuery },
      ])
    }, 350)
    return () => clearTimeout(t)
  }, [recQuery])

  function addRec(rec: Recommendation) {
    if (form.recommendations.length >= 5) return
    if (form.recommendations.some(r => r.id === rec.id)) return
    setForm(f => ({ ...f, recommendations: [...f.recommendations, rec] }))
    setRecQuery('')
    setRecResults([])
  }

  function removeRec(id: string) {
    setForm(f => ({ ...f, recommendations: f.recommendations.filter(r => r.id !== id) }))
  }

  // ── Submit ────────────────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit()) return
    setSubmitting(true)
    setSubmitError(null)

    // Re-verify location fresh at submit time — the user must still be near the place.
    let coords
    try {
      coords = await ensureLocation(`To publish a verified review for ${place.name}, we need to confirm you're here.`)
    } catch {
      setSubmitting(false)
      setSubmitError('Location permission is required to publish a verified review.')
      return
    }

    try {
      const r = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place_id: place.id,
          rating: form.overallRating,
          body: form.body,
          gps_verified: true,
          gps_lat: coords.lat,
          gps_lng: coords.lng,
          gps_accuracy_m: coords.accuracy,
          visit_date: form.visitDate || null,
          tagged_user_ids: form.taggedUsers.map(u => u.id),
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        if (r.status === 401) { window.location.href = '/login'; return }
        throw new Error(d.error || 'Failed to publish review')
      }
      // Fire-and-forget invites by email
      if (form.inviteEmails.length > 0) {
        fetch('/api/invites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            emails: form.inviteEmails,
            context: 'review',
            subject_text: `Just left a review for ${place.name}.`,
          }),
        }).catch(() => {})
      }
      setSubmitted(true)
    } catch (e: any) {
      setSubmitError(e.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  // ── No place chosen yet — show picker ─────────────────────────────────────────

  if (!place) {
    return <ReviewPickPlaceScreen onPick={(p) => router.push(`/reviews/new?place=${encodeURIComponent(p.slug || p.id)}`)} />
  }

  // ── Guard: no valid check-in ──────────────────────────────────────────────────

  if (!checkInValid) {
    return <NoCheckinGate place={place} />
  }

  // ── Success screen ────────────────────────────────────────────────────────────

  if (submitted) {
    return <SuccessScreen place={place} router={router} />
  }

  return (
    <main className="min-h-screen bg-snow">
      {/* GPS banner — always visible */}
      <GpsBanner place={place} />

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Place header */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' as const, marginBottom: -24 }}>
          <button onClick={() => router.push('/reviews/new')} title="Change place"
            style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 13, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontWeight: 600 }}>
            ✕ Change place
          </button>
        </div>
        <PlaceHeader place={place} />

        {/* Step indicator */}
        <StepIndicator current={step} />

        <form onSubmit={handleSubmit} noValidate>
          {/* ── Step 1: Context ─────────────────────────────────────────── */}
          {step === 1 && (
            <Step1
              form={form}
              place={place}
              onOverall={setOverall}
              onField={(k, v) => setForm(f => ({ ...f, [k]: v }))}
            />
          )}

          {/* ── Step 2: Sub-ratings ─────────────────────────────────────── */}
          {step === 2 && (
            <Step2
              form={form}
              defs={subRatingDefs}
              onSubRating={setSubRating}
            />
          )}

          {/* ── Step 3: Body + extras ───────────────────────────────────── */}
          {step === 3 && (
            <Step3
              form={form}
              wordCount={wordCount}
              wordsLeft={wordsLeft}
              fileRef={fileRef}
              recQuery={recQuery}
              recResults={recResults}
              onBody={body => setForm(f => ({ ...f, body }))}
              onPhotoSelect={handlePhotoSelect}
              onRemovePhoto={removePhoto}
              onRecQuery={setRecQuery}
              onAddRec={addRec}
              onRemoveRec={removeRec}
            />
          )}

          {submitError && step === 3 && (
            <div className="mt-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {submitError}
            </div>
          )}

          {/* Navigation buttons */}
          <FormNav
            step={step}
            canNext={step === 1 ? canAdvanceStep1() : step === 2 ? canAdvanceStep2() : canSubmit()}
            submitting={submitting}
            onBack={() => setStep(s => (s - 1) as Step)}
            onNext={() => setStep(s => (s + 1) as Step)}
          />
        </form>
      </div>
    </main>
  )
}

// ─── GPS Banner ───────────────────────────────────────────────────────────────

function GpsBanner({ place }: { place: Place }) {
  return (
    <div className="bg-earth-800 text-white py-2.5 px-4">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-earth-300 animate-pulse flex-shrink-0" />
        <p className="text-sm">
          <span className="font-medium">GPS verified check-in</span>
          <span className="text-earth-300 ml-2">· {place.name} · 72-hour review window active</span>
        </p>
      </div>
    </div>
  )
}

// ─── Place header ─────────────────────────────────────────────────────────────

function PlaceHeader({ place }: { place: Place }) {
  return (
    <div className="mb-8 animate-fade-up">
      <p className="text-xs font-medium text-mist uppercase tracking-widest mb-1">
        Writing a review for
      </p>
      <h1 className="font-display font-bold text-3xl text-ink tracking-tight leading-tight mb-1">
        {place.name}
      </h1>
      <p className="text-sm text-mist">{place.address}</p>
    </div>
  )
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: 'Context' },
    { n: 2, label: 'Ratings' },
    { n: 3, label: 'Your story' },
  ] as const

  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map(({ n, label }, i) => (
        <div key={n} className="flex items-center flex-1">
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-slow',
              current === n
                ? 'bg-earth-800 text-white shadow-gps scale-110'
                : current > n
                ? 'bg-earth-500 text-white'
                : 'bg-fog text-mist'
            )}>
              {current > n ? '✓' : n}
            </div>
            <span className={cn(
              'text-xs font-medium hidden sm:block transition-colors duration-base',
              current === n ? 'text-earth-800' : current > n ? 'text-earth-500' : 'text-mist'
            )}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn(
              'flex-1 h-px mx-3 transition-colors duration-slow',
              current > n ? 'bg-earth-500' : 'bg-fog'
            )} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Step 1: Context ─────────────────────────────────────────────────────────

interface Step1Props {
  form:      FormData
  place:     Place
  onOverall: (n: number) => void
  onField:   (key: string, val: unknown) => void
}

function Step1({ form, place, onOverall, onField }: Step1Props) {
  return (
    <div className="space-y-8 animate-fade-up">
      {/* Overall rating */}
      <section>
        <h2 className="font-display font-semibold text-xl text-ink mb-1">
          Overall, how was it?
        </h2>
        <p className="text-sm text-mist mb-5">
          Give {place.name} an overall score before you dig into the details.
        </p>
        <OverallStarPicker value={form.overallRating} onChange={onOverall} />
      </section>

      {/* Traveller type */}
      <section>
        <h2 className="font-display font-semibold text-xl text-ink mb-1">
          Who were you travelling with?
        </h2>
        <p className="text-sm text-mist mb-4">
          Helps other travellers find reviews from people like them.
        </p>
        <TravellerTypePicker
          value={form.travellerType}
          onChange={v => onField('travellerType', v)}
        />
      </section>

      {/* Nights stayed (accommodation only) */}
      {SHOWS_NIGHTS.includes(place.category) && (
        <section>
          <h2 className="font-display font-semibold text-xl text-ink mb-1">
            How many nights did you stay?
          </h2>
          <NightsPicker
            value={form.nightsStayed}
            onChange={v => onField('nightsStayed', v)}
          />
        </section>
      )}

      {/* Visit date */}
      <section>
        <h2 className="font-display font-semibold text-xl text-ink mb-1">
          When did you visit?
        </h2>
        <p className="text-sm text-mist mb-3">Pick the exact date.</p>
        <input
          type="date"
          value={form.visitDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={e => onField('visitDate', e.target.value)}
          className={cn(
            'border border-fog rounded-lg px-4 py-3 text-base text-ink bg-white',
            'focus:outline-none focus:border-earth-700 focus:ring-2 focus:ring-earth-50',
            'transition-all duration-fast'
          )}
        />
      </section>

      {/* Travel companions: tag registered users */}
      <section>
        <h2 className="font-display font-semibold text-xl text-ink mb-1">
          Travel companions
        </h2>
        <p className="text-sm text-mist mb-3">Tag fellow BugBitten travellers who were with you.</p>
        <UserTagInput
          value={form.taggedUsers}
          onChange={v => onField('taggedUsers', v)}
        />
      </section>

      {/* Invite by email or Facebook */}
      <section>
        <h2 className="font-display font-semibold text-xl text-ink mb-1">
          Invite people you travelled with
        </h2>
        <p className="text-sm text-mist mb-3">Not on BugBitten yet? Invite by email or share to Facebook so they can join.</p>
        <EmailInviteInput
          value={form.inviteEmails}
          onChange={v => onField('inviteEmails', v)}
        />
        <button
          type="button"
          onClick={() => {
            const url = encodeURIComponent('https://bugbitten.com/signup?ref=' + encodeURIComponent(place.name));
            const text = encodeURIComponent(`Just reviewed ${place.name} on BugBitten — join me to share our travel adventures!`);
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`, '_blank', 'noopener,width=600,height=500');
          }}
          className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-fog hover:bg-haze transition-colors"
        >
          <span style={{fontSize:18}}>📘</span> Share to Facebook
        </button>
      </section>
    </div>
  )
}

// ─── Tag-companions autocomplete ──────────────────────────────────────────────

function UserTagInput({ value, onChange }: { value: TaggedUser[]; onChange: (v: TaggedUser[]) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<TaggedUser[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().length < 1) { setResults([]); return }
      try {
        const r = await fetch('/api/users/search?q=' + encodeURIComponent(q.trim()))
        if (!r.ok) return
        const d = await r.json()
        const have = new Set(value.map(u => u.id))
        setResults((d.users || []).filter((u: any) => !have.has(u.id)))
        setOpen(true)
      } catch {}
    }, 250)
    return () => clearTimeout(t)
  }, [q, value])

  const add = (u: TaggedUser) => { onChange([...value, u]); setQ(''); setResults([]); setOpen(false) }
  const remove = (id: string) => onChange(value.filter(u => u.id !== id))

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map(u => (
          <span key={u.id} className="inline-flex items-center gap-1.5 bg-earth-50 text-earth-800 border border-earth-300/30 text-sm font-medium px-3 py-1.5 rounded-full">
            @{u.username}
            <button type="button" onClick={() => remove(u.id)} className="text-earth-700 hover:text-ink ml-0.5" aria-label={`Remove ${u.username}`}>×</button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search by username or display name…"
        className={cn(
          'w-full border border-fog rounded-lg px-4 py-3 text-base text-ink bg-white',
          'focus:outline-none focus:border-earth-700 focus:ring-2 focus:ring-earth-50',
          'transition-all duration-fast'
        )}
      />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-fog rounded-lg shadow-lg z-10 overflow-hidden">
          {results.map(u => (
            <button key={u.id} type="button" onClick={() => add(u)}
              className="w-full text-left px-4 py-2.5 text-sm text-ink hover:bg-earth-50 flex items-center gap-2 border-b border-fog last:border-b-0">
              {u.avatar_url
                ? <img loading="lazy" decoding="async" src={u.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                : <span className="w-7 h-7 rounded-full bg-earth-500 text-white flex items-center justify-center text-xs font-bold">{(u.display_name || u.username || '?')[0].toUpperCase()}</span>}
              <span className="font-medium">{u.display_name || u.username}</span>
              <span className="text-mist text-xs">@{u.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Email invites (chips) ────────────────────────────────────────────────────

function EmailInviteInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const tryAdd = () => {
    const e = draft.trim().toLowerCase()
    if (!e) return
    if (!EMAIL_RE.test(e)) { setError('Not a valid email'); return }
    if (value.includes(e)) { setError('Already added'); return }
    if (value.length >= 10) { setError('Max 10 invites'); return }
    onChange([...value, e]); setDraft(''); setError('')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map(e => (
          <span key={e} className="inline-flex items-center gap-1.5 bg-sand-100 text-amber-800 border border-sand-500/30 text-sm font-medium px-3 py-1.5 rounded-full">
            {e}
            <button type="button" onClick={() => onChange(value.filter(x => x !== e))} className="text-amber-700 hover:text-amber-900 ml-0.5">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="email"
          value={draft}
          onChange={e => { setDraft(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); tryAdd() } }}
          placeholder="friend@email.com"
          className={cn(
            'flex-1 border border-fog rounded-lg px-4 py-3 text-base text-ink bg-white',
            'focus:outline-none focus:border-earth-700 focus:ring-2 focus:ring-earth-50',
            'transition-all duration-fast'
          )}
        />
        <button type="button" onClick={tryAdd} className="px-4 py-3 rounded-lg bg-earth-800 text-white text-sm font-medium hover:bg-earth-700">Add</button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {value.length > 0 && <p className="text-xs text-mist mt-2">{value.length} invite{value.length === 1 ? '' : 's'} will be sent when you publish the review.</p>}
    </div>
  )
}

// ─── Overall star picker ──────────────────────────────────────────────────────

const STAR_LABELS = ['', 'Terrible', 'Poor', 'Average', 'Very good', 'Excellent']

function OverallStarPicker({
  value,
  onChange,
}: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0)
  const display = hover || value

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Overall rating">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''} — ${STAR_LABELS[n]}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            className={cn(
              'text-5xl leading-none transition-all duration-fast',
              'hover:scale-110 active:scale-95',
              n <= display ? 'text-sand-700' : 'text-fog'
            )}
          >
            ★
          </button>
        ))}
      </div>
      <div className={cn(
        'text-base font-medium transition-all duration-base',
        display > 0 ? 'text-earth-800 opacity-100' : 'opacity-0'
      )}>
        {STAR_LABELS[display]}
      </div>
    </div>
  )
}

// ─── Traveller type picker ────────────────────────────────────────────────────

const TRAVELLER_TYPES: Array<{ value: TravellerType; label: string; icon: string }> = [
  { value: 'solo',   label: 'Solo',   icon: '🧍' },
  { value: 'couple', label: 'Couple', icon: '👫' },
  { value: 'group',  label: 'Group',  icon: '👥' },
  { value: 'family', label: 'Family', icon: '👨‍👩‍👧' },
]

function TravellerTypePicker({
  value,
  onChange,
}: { value: TravellerType | ''; onChange: (v: TravellerType) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {TRAVELLER_TYPES.map(({ value: v, label, icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            'flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2',
            'transition-all duration-fast font-medium text-sm',
            'hover:border-earth-700 hover:bg-earth-50',
            'active:scale-[0.97]',
            value === v
              ? 'border-earth-800 bg-earth-50 text-earth-800'
              : 'border-fog bg-white text-slate'
          )}
          aria-pressed={value === v}
        >
          <span className="text-2xl">{icon}</span>
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Nights picker ────────────────────────────────────────────────────────────

function NightsPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className={cn(
          'w-10 h-10 rounded-full border-2 border-fog text-xl font-light',
          'flex items-center justify-center text-slate',
          'hover:border-earth-700 hover:text-earth-800 hover:bg-earth-50',
          'transition-all duration-fast active:scale-95',
          value <= 1 && 'opacity-30 pointer-events-none'
        )}
      >
        −
      </button>
      <div className="text-center">
        <p className="font-display font-bold text-4xl text-earth-800 leading-none">{value}</p>
        <p className="text-xs text-mist mt-1">night{value !== 1 ? 's' : ''}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(365, value + 1))}
        className={cn(
          'w-10 h-10 rounded-full border-2 border-fog text-xl font-light',
          'flex items-center justify-center text-slate',
          'hover:border-earth-700 hover:text-earth-800 hover:bg-earth-50',
          'transition-all duration-fast active:scale-95'
        )}
      >
        +
      </button>
    </div>
  )
}

// ─── Step 2: Sub-ratings ──────────────────────────────────────────────────────

interface Step2Props {
  form:        FormData
  defs:        SubRating[]
  onSubRating: (key: string, val: number) => void
}

function Step2({ form, defs, onSubRating }: Step2Props) {
  const allSet = defs.every(d => form.subRatings[d.key] > 0)

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="mb-2">
        <h2 className="font-display font-semibold text-xl text-ink mb-1">
          Rate the details
        </h2>
        <p className="text-sm text-mist">
          These scores help travellers pick the right place for their style.
        </p>
      </div>

      {defs.map((def, i) => (
        <SubRatingRow
          key={def.key}
          def={def}
          value={form.subRatings[def.key] ?? 0}
          onChange={v => onSubRating(def.key, v)}
          delay={i * 60}
        />
      ))}

      {!allSet && (
        <p className="text-xs text-mist pt-2">
          Rate all {defs.length} categories to continue
        </p>
      )}
    </div>
  )
}

// ─── Sub-rating row ───────────────────────────────────────────────────────────

interface SubRatingRowProps {
  def:      SubRating
  value:    number
  onChange: (v: number) => void
  delay?:   number
}

function SubRatingRow({ def, value, onChange, delay = 0 }: SubRatingRowProps) {
  const [hover, setHover] = useState(0)
  const display = hover || value
  const pct = (display / 5) * 100

  return (
    <div
      className="animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{def.icon}</span>
          <div>
            <p className="font-medium text-sm text-ink">{def.label}</p>
            <p className="text-xs text-mist">{def.hint}</p>
          </div>
        </div>
        <div className={cn(
          'text-sm font-semibold transition-all duration-base',
          value > 0 ? 'text-earth-800' : 'text-mist'
        )}>
          {value > 0 ? `${value}/5` : '—'}
        </div>
      </div>

      {/* Slider track */}
      <div
        className="relative h-3 bg-fog rounded-full cursor-pointer group"
        onMouseEnter={() => {}}
        onMouseLeave={() => setHover(0)}
        onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
          onChange(Math.round(pct * 5) || 1)
        }}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect()
          const p    = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
          setHover(Math.round(p * 5) || 1)
        }}
        role="slider"
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={value}
        aria-label={def.label}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'ArrowRight') onChange(Math.min(5, value + 1))
          if (e.key === 'ArrowLeft')  onChange(Math.max(1, value - 1))
        }}
      >
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 bg-earth-500 rounded-full transition-all duration-fast"
          style={{ width: `${(display / 5) * 100}%` }}
        />
        {/* Thumb */}
        {display > 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-earth-800 border-2 border-white shadow-md transition-all duration-fast"
            style={{ left: `calc(${(display / 5) * 100}% - 10px)` }}
          />
        )}
        {/* Tick marks */}
        <div className="absolute inset-0 flex items-center justify-between px-0 pointer-events-none">
          {[1, 2, 3, 4, 5].map(n => (
            <div
              key={n}
              className={cn(
                'w-1 h-1 rounded-full transition-colors duration-fast',
                n <= display ? 'bg-earth-300' : 'bg-mist'
              )}
              style={{ marginLeft: n === 1 ? '0' : undefined, marginRight: n === 5 ? '0' : undefined }}
            />
          ))}
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-1">
        <span className="text-xs text-mist">Poor</span>
        <span className="text-xs text-mist">Excellent</span>
      </div>
    </div>
  )
}

// ─── Step 3: Body + extras ────────────────────────────────────────────────────

interface Step3Props {
  form:          FormData
  wordCount:     number
  wordsLeft:     number
  fileRef:       React.RefObject<HTMLInputElement>
  recQuery:      string
  recResults:    Recommendation[]
  onBody:        (v: string) => void
  onPhotoSelect: (e: ChangeEvent<HTMLInputElement>) => void
  onRemovePhoto: (id: string) => void
  onRecQuery:    (v: string) => void
  onAddRec:      (r: Recommendation) => void
  onRemoveRec:   (id: string) => void
}

function Step3({
  form, wordCount, wordsLeft, fileRef,
  recQuery, recResults,
  onBody, onPhotoSelect, onRemovePhoto,
  onRecQuery, onAddRec, onRemoveRec,
}: Step3Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasMinWords = wordsLeft === 0

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }, [form.body])

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Body text */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-display font-semibold text-xl text-ink">
            Tell your story
          </h2>
          <div className={cn(
            'text-xs font-medium transition-colors duration-base',
            hasMinWords ? 'text-earth-700' : 'text-mist'
          )}>
            {wordCount} / {MIN_WORDS} words
          </div>
        </div>

        {/* Word count progress bar */}
        <div className="h-1 bg-fog rounded-full mb-4 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-base',
              hasMinWords ? 'bg-earth-500' : 'bg-earth-300'
            )}
            style={{ width: `${Math.min(100, (wordCount / MIN_WORDS) * 100)}%` }}
          />
        </div>

        <textarea
          ref={textareaRef}
          value={form.body}
          onChange={e => onBody(e.target.value)}
          placeholder="What made this place special — or disappointing? The more specific and honest you are, the more useful your review will be for other travellers. Tip: write about what surprised you, what you'd do differently, and who you think would love (or hate) it here."
          rows={6}
          className={cn(
            'w-full border border-fog rounded-xl px-4 py-3.5 text-base text-ink',
            'placeholder:text-mist leading-relaxed',
            'focus:outline-none focus:border-earth-700 focus:ring-2 focus:ring-earth-50',
            'transition-all duration-fast resize-none overflow-hidden',
            'font-body'
          )}
        />

        {!hasMinWords && form.body.length > 0 && (
          <p className="text-xs text-mist mt-2">
            {wordsLeft} more word{wordsLeft !== 1 ? 's' : ''} needed — be specific!
          </p>
        )}
      </section>

      {/* Photo upload */}
      <section>
        <h2 className="font-display font-semibold text-xl text-ink mb-1">
          Add photos
          <span className="text-sm font-normal text-mist ml-2">optional</span>
        </h2>
        <p className="text-sm text-mist mb-4">Up to 8 photos. Show what the place actually looks like.</p>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {form.photos.map(photo => (
            <div key={photo.id} className="relative aspect-square">
              <img
                src={photo.preview}
                alt="Review photo"
                className="w-full h-full object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => onRemovePhoto(photo.id)}
                className={cn(
                  'absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full',
                  'bg-ink text-white flex items-center justify-center',
                  'text-xs font-bold hover:bg-danger transition-colors duration-fast',
                  'shadow-md'
                )}
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}

          {form.photos.length < 8 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={cn(
                'aspect-square rounded-lg border-2 border-dashed border-fog',
                'flex flex-col items-center justify-center gap-1',
                'text-mist hover:border-earth-700 hover:text-earth-700',
                'transition-all duration-fast hover:bg-earth-50',
                'text-xs font-medium'
              )}
              aria-label="Add photos"
            >
              <span className="text-2xl leading-none">+</span>
              Photo
            </button>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onPhotoSelect}
          aria-hidden="true"
        />
      </section>

      {/* Attraction recommendations */}
      <section>
        <h2 className="font-display font-semibold text-xl text-ink mb-1">
          Recommend nearby attractions
          <span className="text-sm font-normal text-mist ml-2">optional — up to 5</span>
        </h2>
        <p className="text-sm text-mist mb-4">
          What else should travellers visit while they're here?
        </p>

        {/* Added recs */}
        {form.recommendations.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {form.recommendations.map(rec => (
              <span
                key={rec.id}
                className="inline-flex items-center gap-1.5 bg-sand-100 text-amber-800 border border-sand-500/30 text-sm font-medium px-3 py-1.5 rounded-full"
              >
                {rec.name}
                <button
                  type="button"
                  onClick={() => onRemoveRec(rec.id)}
                  className="text-amber-600 hover:text-amber-900 transition-colors ml-0.5"
                  aria-label={`Remove ${rec.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search input */}
        {form.recommendations.length < 5 && (
          <div className="relative">
            <input
              type="text"
              value={recQuery}
              onChange={e => onRecQuery(e.target.value)}
              placeholder="Search for a place to recommend…"
              className={cn(
                'w-full border border-fog rounded-lg px-4 py-3 text-base text-ink',
                'placeholder:text-mist',
                'focus:outline-none focus:border-earth-700 focus:ring-2 focus:ring-earth-50',
                'transition-all duration-fast'
              )}
            />

            {/* Dropdown */}
            {recResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-fog rounded-lg shadow-lg z-10 overflow-hidden">
                {recResults.map(rec => (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => onAddRec(rec)}
                    className="w-full text-left px-4 py-3 text-sm text-ink hover:bg-earth-50 transition-colors flex items-center gap-2"
                  >
                    <span className="text-earth-500">📍</span>
                    {rec.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Form navigation ──────────────────────────────────────────────────────────

interface FormNavProps {
  step:       Step
  canNext:    boolean
  submitting: boolean
  onBack:     () => void
  onNext:     () => void
}

function FormNav({ step, canNext, submitting, onBack, onNext }: FormNavProps) {
  return (
    <div className="flex items-center justify-between mt-10 pt-6 border-t border-fog">
      {step > 1 ? (
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-slate',
            'border border-fog hover:bg-haze hover:text-ink',
            'transition-all duration-fast active:scale-[0.97]'
          )}
        >
          ← Back
        </button>
      ) : (
        <div />
      )}

      {step < 3 ? (
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className={cn(
            'flex items-center gap-2 px-7 py-2.5 rounded-lg text-sm font-medium',
            'transition-all duration-fast active:scale-[0.97]',
            canNext
              ? 'bg-earth-800 text-white hover:bg-earth-700 shadow-sm'
              : 'bg-fog text-mist cursor-not-allowed'
          )}
        >
          Continue →
        </button>
      ) : (
        <button
          type="submit"
          disabled={!canNext || submitting}
          className={cn(
            'flex items-center gap-2 px-7 py-2.5 rounded-lg text-sm font-semibold',
            'transition-all duration-fast active:scale-[0.97]',
            canNext && !submitting
              ? 'bg-earth-800 text-white hover:bg-earth-700 shadow-sm'
              : 'bg-fog text-mist cursor-not-allowed'
          )}
        >
          {submitting ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Submitting…
            </>
          ) : (
            'Publish review →'
          )}
        </button>
      )}
    </div>
  )
}

// ─── No check-in gate ─────────────────────────────────────────────────────────

function NoCheckinGate({ place }: { place: Place }) {
  return (
    <main className="min-h-screen bg-snow flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center">
        <div className="text-5xl mb-4">📍</div>
        <h1 className="font-display font-bold text-2xl text-ink mb-2">
          Check in first
        </h1>
        <p className="text-sm text-mist mb-6 leading-relaxed">
          To leave a verified review for <strong className="text-ink">{place.name}</strong>,
          you need to check in within 5 km. Your 72-hour review window starts when you check in.
        </p>
        <a
          href={`/check-in?place=${place.id}`}
          className={cn(
            'inline-flex items-center gap-2 px-7 py-3 rounded-lg',
            'bg-earth-800 text-white font-medium text-sm',
            'hover:bg-earth-700 transition-colors duration-fast'
          )}
        >
          Check in here
        </a>
      </div>
    </main>
  )
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ place, router }: { place: Place; router: ReturnType<typeof useRouter> }) {
  return (
    <main className="min-h-screen bg-snow flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center animate-scale-in">
        <div className="text-6xl mb-4">🌿</div>
        <h1 className="font-display font-bold text-2xl text-ink mb-2">
          Review published!
        </h1>
        <p className="text-sm text-mist mb-2 leading-relaxed">
          Your GPS-verified review of <strong className="text-ink">{place.name}</strong> is now
          live and helping other travellers.
        </p>
        <p className="text-xs text-mist mb-8">
          Reviews from verified check-ins are ranked higher on BugBitten.
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.push(`/places/${place.id}`)}
            className={cn(
              'w-full py-3 rounded-lg bg-earth-800 text-white font-medium text-sm',
              'hover:bg-earth-700 transition-colors duration-fast'
            )}
          >
            See all reviews
          </button>
          <button
            type="button"
            onClick={() => router.push('/feed')}
            className={cn(
              'w-full py-3 rounded-lg border border-fog text-slate text-sm font-medium',
              'hover:bg-haze transition-colors duration-fast'
            )}
          >
            Back to feed
          </button>
        </div>
      </div>
    </main>
  )
}

export default function ReviewFormPage() {
  return (
    <Suspense fallback={null}>
      <ReviewFormPageInner />
    </Suspense>
  )
}

function ReviewPickPlaceScreen({ onPick }: { onPick: (p: { id: string; slug?: string; name: string }) => void }) {
  const [q, setQ] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const go = async () => {
    if (!q.trim() || submitting) return
    setSubmitting(true); setErr('')
    try {
      const r = await fetch('/api/places/upsert-from-location', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: q.trim() }),
      })
      const d = await r.json()
      if (!r.ok || !d?.place) { setErr(d?.error || 'Place not found'); return }
      onPick({ id: d.place.id, slug: d.place.slug, name: d.place.name })
    } catch { setErr('Network error') } finally { setSubmitting(false) }
  }
  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '40px 20px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 28 }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 800, margin: '0 0 8px' }}>Write a review</h1>
        <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 20px' }}>Which place are you reviewing?</p>
        <PlaceAutocomplete value={q} onChange={setQ} placeholder="e.g. Villa Kayu Lama, Ubud" inputStyle={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:10, padding:'12px 14px', fontSize:14, outline:'none', boxSizing:'border-box' as const }} />
        {err && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 10 }}>{err}</div>}
        <button onClick={go} disabled={!q.trim() || submitting}
          style={{ marginTop: 14, background: q.trim() ? 'var(--brand)' : '#e5e7eb', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: q.trim() && !submitting ? 'pointer' : 'default', width: '100%' }}>
          {submitting ? 'Loading…' : 'Continue'}
        </button>
      </div>
    </main>
  )
}
