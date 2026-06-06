'use client'

import {
  useState, useRef, useCallback, useEffect,
  type ChangeEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { PlaceAutocomplete } from '@/components/features/PlaceAutocomplete'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5
type TravelStatus = 'travelling' | 'planning' | 'home'
type Gender = 'm' | 'f' | 'other' | 'undisclosed'

interface OnboardingData {
  displayName:       string
  bio:               string
  gender:            Gender | ''
  birthPlace:        string
  currentlyLiving:   string
  travelStatus:      TravelStatus | ''
  avatarFile?:       File
  avatarPreview?:    string
  interests:         string[]
  visitedCountries:  string[]
  wishlistCountries: string[]
}

// ─── Interests list ───────────────────────────────────────────────────────────

const INTERESTS = [
  { key: 'backpacking',   label: 'Backpacking',     icon: '🎒' },
  { key: 'hiking',        label: 'Hiking',           icon: '🥾' },
  { key: 'yoga',          label: 'Yoga',             icon: '🧘' },
  { key: 'surfing',       label: 'Surfing',          icon: '🏄' },
  { key: 'photography',   label: 'Photography',      icon: '📷' },
  { key: 'street_food',   label: 'Street food',      icon: '🍜' },
  { key: 'camping',       label: 'Camping',          icon: '⛺' },
  { key: 'diving',        label: 'Diving',           icon: '🤿' },
  { key: 'nightlife',     label: 'Nightlife',        icon: '🎶' },
  { key: 'volunteering',  label: 'Volunteering',     icon: '🤝' },
  { key: 'cycling',       label: 'Cycling',          icon: '🚴' },
  { key: 'rock_climbing', label: 'Rock climbing',    icon: '🧗' },
  { key: 'meditation',    label: 'Meditation',       icon: '🌿' },
  { key: 'crypto',        label: 'Crypto / web3',    icon: '₿' },
  { key: 'sports',        label: 'Sports',           icon: '⚽' },
  { key: 'language',      label: 'Language learning',icon: '🗣' },
  { key: 'arts',          label: 'Arts & crafts',    icon: '🎨' },
  { key: 'music',         label: 'Music',            icon: '🎵' },
]

// ─── Country list (abbreviated — use a full ISO list in production) ────────────

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Armenia', 'Australia',
  'Austria', 'Azerbaijan', 'Bangladesh', 'Belgium', 'Bolivia', 'Bosnia',
  'Brazil', 'Bulgaria', 'Cambodia', 'Canada', 'Chile', 'China', 'Colombia',
  'Croatia', 'Cuba', 'Czech Republic', 'Denmark', 'Ecuador', 'Egypt',
  'Estonia', 'Ethiopia', 'Finland', 'France', 'Georgia', 'Germany', 'Ghana',
  'Greece', 'Guatemala', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran',
  'Ireland', 'Israel', 'Italy', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya',
  'Kosovo', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lithuania',
  'Luxembourg', 'Madagascar', 'Malaysia', 'Mexico', 'Moldova', 'Mongolia',
  'Montenegro', 'Morocco', 'Myanmar', 'Nepal', 'Netherlands', 'New Zealand',
  'Nicaragua', 'Nigeria', 'North Macedonia', 'Norway', 'Pakistan', 'Panama',
  'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Romania', 'Russia',
  'Rwanda', 'Saudi Arabia', 'Senegal', 'Serbia', 'Singapore', 'Slovakia',
  'Slovenia', 'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sweden',
  'Switzerland', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Tunisia',
  'Turkey', 'Turkmenistan', 'Uganda', 'Ukraine', 'United Kingdom', 'Uruguay',
  'USA', 'Uzbekistan', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
]

const TRAVEL_STATUSES: Array<{ value: TravelStatus; label: string; icon: string; desc: string }> = [
  { value: 'travelling', label: 'Travelling',        icon: '✈️', desc: 'Currently on the road' },
  { value: 'planning',   label: 'Planning a trip',   icon: '🗺', desc: 'Getting ready to go' },
  { value: 'home',       label: 'At home',           icon: '🏡', desc: 'Between adventures' },
]

const GENDERS: Array<{ value: Gender; label: string }> = [
  { value: 'm',           label: 'Male' },
  { value: 'f',           label: 'Female' },
  { value: 'other',       label: 'Non-binary / other' },
  { value: 'undisclosed', label: 'Prefer not to say' },
]

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: 'Profile',    desc: 'Tell travellers about yourself' },
  { n: 2, label: 'Interests',  desc: 'What do you love doing?' },
  { n: 3, label: 'Visited',    desc: 'Where have you been?' },
  { n: 4, label: 'Wishlist',   desc: 'Where next?' },
  { n: 5, label: 'Invite',     desc: 'Grow your network' },
] as const

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()

  const [step, setStep] = useState<Step>(1)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<OnboardingData>({
    displayName:       '',
    bio:               '',
    gender:            '',
    birthPlace:        '',
    currentlyLiving:   '',
    travelStatus:      '',
    interests:         [],
    visitedCountries:  [],
    wishlistCountries: [],
  })

  // Preload existing profile so revisits don't show a blank form
  useEffect(() => {
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => {
      const u = d?.user; if (!u) return;
      setData(prev => ({
        ...prev,
        displayName:       u.display_name || prev.displayName,
        bio:               u.bio || prev.bio,
        currentlyLiving:   u.location || prev.currentlyLiving,
        travelStatus:      u.travel_status || prev.travelStatus,
        interests:         Array.isArray(u.interests) ? u.interests : prev.interests,
        visitedCountries:  Array.isArray(u.visited_countries) ? u.visited_countries : prev.visitedCountries,
        wishlistCountries: Array.isArray(u.wishlist_countries) ? u.wishlist_countries : prev.wishlistCountries,
      }));
    }).catch(() => {});
  }, [])

  function update<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setData(d => ({ ...d, [key]: value }))
  }

  function toggleInterest(key: string) {
    setData(d => ({
      ...d,
      interests: d.interests.includes(key)
        ? d.interests.filter(i => i !== key)
        : [...d.interests, key],
    }))
  }

  function toggleCountry(country: string, list: 'visitedCountries' | 'wishlistCountries') {
    setData(d => ({
      ...d,
      [list]: d[list].includes(country)
        ? d[list].filter(c => c !== country)
        : [...d[list], country],
    }))
  }

  // ── Validation per step ────────────────────────────────────────────────────

  const canAdvance: Record<Step, boolean> = {
    1: data.displayName.trim().length >= 2 && data.travelStatus !== '',
    2: data.interests.length >= 3,
    3: data.visitedCountries.length >= 1,
    4: true,
    5: true,
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleFinish() {
    setSaving(true)
    try {
      let avatar_url: string | undefined
      if (data.avatarFile) {
        try {
          const fd = new FormData()
          fd.append('file', data.avatarFile)
          fd.append('folder', 'avatars')
          const ur = await fetch('/api/upload', { method: 'POST', body: fd })
          if (ur.ok) {
            const ud = await ur.json()
            avatar_url = ud.url
          }
        } catch {}
      }
      const r = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: data.displayName,
          bio: data.bio,
          location: data.currentlyLiving,
          birth_place: data.birthPlace,
          gender: data.gender || null,
          travel_status: data.travelStatus || null,
          interests: data.interests,
          visited_countries: data.visitedCountries,
          wishlist_countries: data.wishlistCountries,
          ...(avatar_url ? { avatar_url } : {}),
        }),
      })
      if (!r.ok && r.status === 401) { router.push('/login'); return }
      router.push('/feed')
    } finally {
      setSaving(false)
    }
  }

  function goNext() {
    if (step < 5) setStep(s => (s + 1) as Step)
    else handleFinish()
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-fog fixed top-0 left-0 right-0 z-50">
        <div
          className="h-full bg-earth-500 transition-all duration-slow ease-smooth"
          style={{ width: `${(step / 5) * 100}%` }}
        />
      </div>

      {/* Header */}
      <div className="pt-6 px-6 flex items-center justify-between">
        <img loading="lazy" decoding="async" src="/brand/logo.webp?v=2" alt="Logo" style={{ height: 40, width: 'auto', display: 'block' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{step} of 5</div>
          <button
            onClick={() => router.push('/feed')}
            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}
          >Skip for now</button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-6 pt-6 pb-4 max-w-lg mx-auto w-full">

        {/* Step heading */}
        <div className="mb-8 animate-fade-up" key={`heading-${step}`}>
          <p className="text-xs font-medium text-earth-500 uppercase tracking-widest mb-1.5">
            Step {step} of 5 — {STEPS[step - 1].label}
          </p>
          <h1 className="font-display font-bold text-3xl text-ink tracking-tight leading-tight">
            {STEPS[step - 1].desc}
          </h1>
        </div>

        {/* Step panels */}
        <div className="flex-1" key={`panel-${step}`}>
          {step === 1 && (
            <Step1Profile
              data={data}
              onUpdate={update}
            />
          )}
          {step === 2 && (
            <Step2Interests
              selected={data.interests}
              onToggle={toggleInterest}
            />
          )}
          {step === 3 && (
            <Step3Countries
              selected={data.visitedCountries}
              onToggle={c => toggleCountry(c, 'visitedCountries')}
              mode="visited"
            />
          )}
          {step === 4 && (
            <Step3Countries
              selected={data.wishlistCountries}
              onToggle={c => toggleCountry(c, 'wishlistCountries')}
              mode="wishlist"
            />
          )}
          {step === 5 && (
            <Step5Invite data={data} />
          )}
        </div>

        {/* Navigation */}
        <div className="pt-6 flex items-center justify-between border-t border-fog mt-6">
          {step > 1 ? (
            <button
              onClick={() => setStep(s => (s - 1) as Step)}
              className="text-sm text-slate hover:text-ink transition-colors font-medium flex items-center gap-1.5"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            {/* Skip for steps where it makes sense */}
            {(step === 4 || step === 5) && (
              <button
                onClick={goNext}
                className="text-sm text-mist hover:text-slate transition-colors"
              >
                Skip
              </button>
            )}

            <button
              onClick={goNext}
              disabled={!canAdvance[step] || saving}
              className={cn(
                'flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-sm',
                'transition-all duration-fast active:scale-[0.97]',
                canAdvance[step] && !saving
                  ? 'bg-earth-800 text-white hover:bg-earth-700 shadow-sm'
                  : 'bg-fog text-mist cursor-not-allowed'
              )}
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-mist border-t-transparent animate-spin" />
                  Saving…
                </>
              ) : step === 5 ? (
                'Start exploring →'
              ) : (
                'Continue →'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step 1: Profile ──────────────────────────────────────────────────────────

function Step1Profile({
  data,
  onUpdate,
}: {
  data:     OnboardingData
  onUpdate: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  function handleAvatarSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    onUpdate('avatarFile', file)
    onUpdate('avatarPreview', URL.createObjectURL(file))
    e.target.value = ''
  }

  const bioLength = data.bio.trim().split(/\s+/).filter(Boolean).length
  const bioMax = 220

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Avatar */}
      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex-shrink-0 group relative"
        >
          <div className={cn(
            'w-20 h-20 rounded-full flex items-center justify-center',
            'border-2 border-dashed border-fog group-hover:border-earth-500',
            'transition-colors duration-fast overflow-hidden',
            'bg-earth-50'
          )}>
            {data.avatarPreview ? (
              <img loading="lazy" decoding="async" src={data.avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl">📷</span>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-earth-800 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            +
          </div>
        </button>
        <div>
          <p className="font-medium text-ink text-sm">Profile photo</p>
          <p className="text-xs text-mist mt-0.5">Optional — helps travellers recognise you</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} aria-hidden="true" />
      </div>

      {/* Display name */}
      <div>
        <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-2">
          Your name *
        </label>
        <input
          type="text"
          value={data.displayName}
          onChange={e => onUpdate('displayName', e.target.value)}
          placeholder="How you want to appear to other travellers"
          className={cn(
            'w-full border border-fog rounded-xl px-4 py-3.5 text-base text-ink',
            'placeholder:text-mist focus:outline-none focus:border-earth-700',
            'focus:ring-2 focus:ring-earth-50 transition-all duration-fast'
          )}
        />
      </div>

      {/* Travel status */}
      <div>
        <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-3">
          Right now you are… *
        </label>
        <div className="grid grid-cols-3 gap-2">
          {TRAVEL_STATUSES.map(({ value, label, icon, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => onUpdate('travelStatus', value)}
              className={cn(
                'flex flex-col items-center gap-1.5 py-3.5 px-2 rounded-xl border-2 text-center',
                'transition-all duration-fast active:scale-[0.97]',
                data.travelStatus === value
                  ? 'border-earth-800 bg-earth-50 text-earth-800'
                  : 'border-fog bg-white text-slate hover:border-earth-300'
              )}
            >
              <span className="text-2xl">{icon}</span>
              <span className="text-xs font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bio */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <label className="text-xs font-semibold text-slate uppercase tracking-wide">
            About you
          </label>
          <span className={cn(
            'text-xs transition-colors',
            bioLength > bioMax ? 'text-danger' : 'text-mist'
          )}>
            {bioLength} / {bioMax} words
          </span>
        </div>
        <textarea
          value={data.bio}
          onChange={e => onUpdate('bio', e.target.value)}
          placeholder="Tell other travellers about yourself — what you love, where you've been, what kind of adventures you seek…"
          rows={4}
          className={cn(
            'w-full border border-fog rounded-xl px-4 py-3.5 text-base text-ink',
            'placeholder:text-mist resize-none leading-relaxed',
            'focus:outline-none focus:border-earth-700 focus:ring-2 focus:ring-earth-50',
            'transition-all duration-fast'
          )}
        />
      </div>

      {/* Optional fields */}
      <details className="group">
        <summary className="text-sm text-earth-700 font-medium cursor-pointer list-none flex items-center gap-2 select-none">
          <span className="text-earth-400 group-open:rotate-90 transition-transform inline-block">▶</span>
          Add more details (optional)
        </summary>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-2">Gender</label>
            <div className="grid grid-cols-2 gap-2">
              {GENDERS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onUpdate('gender', value)}
                  className={cn(
                    'py-2.5 px-3 rounded-lg border text-sm font-medium transition-all duration-fast',
                    data.gender === value
                      ? 'border-earth-700 bg-earth-50 text-earth-800'
                      : 'border-fog bg-white text-slate hover:border-earth-300'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-2">Birth place</label>
            <PlaceAutocomplete
              value={data.birthPlace}
              onChange={v => onUpdate('birthPlace', v)}
              placeholder="Start typing a city…"
              inputStyle={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:12, padding:'12px 16px', fontSize:14, color:'#111827', outline:'none', boxSizing:'border-box' }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate uppercase tracking-wide mb-2">Currently living</label>
            <PlaceAutocomplete
              value={data.currentlyLiving}
              onChange={v => onUpdate('currentlyLiving', v)}
              placeholder="Start typing a city…"
              inputStyle={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:12, padding:'12px 16px', fontSize:14, color:'#111827', outline:'none', boxSizing:'border-box' }}
            />
          </div>
        </div>
      </details>
    </div>
  )
}

// ─── Step 2: Interests ────────────────────────────────────────────────────────

function Step2Interests({
  selected,
  onToggle,
}: {
  selected: string[]
  onToggle: (key: string) => void
}) {
  return (
    <div className="animate-fade-up">
      <p className="text-sm text-mist mb-5">Pick at least 3. This helps us surface relevant travellers and destinations.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {INTERESTS.map(({ key, label, icon }, i) => {
          const active = selected.includes(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => onToggle(key)}
              style={{ animationDelay: `${i * 30}ms` }}
              className={cn(
                'flex items-center gap-2.5 py-3 px-4 rounded-xl border-2 text-left',
                'transition-all duration-fast active:scale-[0.97] animate-fade-up',
                active
                  ? 'border-earth-800 bg-earth-50 text-earth-800'
                  : 'border-fog bg-white text-slate hover:border-earth-300 hover:bg-snow'
              )}
            >
              <span className="text-xl flex-shrink-0">{icon}</span>
              <span className="text-sm font-medium leading-tight">{label}</span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-mist text-center mt-4">
        {selected.length < 3
          ? `Select ${3 - selected.length} more to continue`
          : `${selected.length} selected`}
      </p>
    </div>
  )
}

// ─── Step 3 & 4: Countries ────────────────────────────────────────────────────

function Step3Countries({
  selected,
  onToggle,
  mode,
}: {
  selected: string[]
  onToggle: (c: string) => void
  mode: 'visited' | 'wishlist'
}) {
  const [search, setSearch] = useState('')

  const filtered = search.trim().length >= 1
    ? COUNTRIES.filter(c => c.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES

  const isVisited = mode === 'visited'

  return (
    <div className="flex flex-col gap-4 animate-fade-up" style={{ minHeight: 0 }}>
      <p className="text-sm text-mist">
        {isVisited
          ? 'These paint your world map green. Select every country you\'ve set foot in.'
          : 'Where are you dreaming of next? Add them to your wishlist.'}
      </p>

      {/* Selected pills */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => onToggle(c)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                'transition-all duration-fast active:scale-[0.97]',
                isVisited
                  ? 'bg-earth-800 text-white hover:bg-earth-900'
                  : 'bg-sand-100 text-amber-800 border border-sand-500/40 hover:bg-sand-500/20'
              )}
            >
              {c} ×
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search countries…"
        className={cn(
          'w-full border border-fog rounded-xl px-4 py-3 text-sm text-ink',
          'placeholder:text-mist focus:outline-none focus:border-earth-700',
          'focus:ring-2 focus:ring-earth-50 transition-all duration-fast'
        )}
      />

      {/* Country grid */}
      <div className="overflow-y-auto flex-1" style={{ maxHeight: '280px' }}>
        <div className="grid grid-cols-2 gap-2">
          {filtered.map(country => {
            const active = selected.includes(country)
            return (
              <button
                key={country}
                type="button"
                onClick={() => onToggle(country)}
                className={cn(
                  'text-left py-2.5 px-3.5 rounded-lg border text-sm font-medium',
                  'transition-all duration-fast active:scale-[0.97]',
                  active && isVisited
                    ? 'border-earth-700 bg-earth-50 text-earth-800'
                    : active && !isVisited
                    ? 'border-sand-700 bg-sand-100 text-amber-800'
                    : 'border-fog bg-white text-slate hover:border-earth-300'
                )}
              >
                {country}
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-center text-mist">
        {selected.length === 0
          ? isVisited ? 'Select at least 1 country to continue' : 'Optional — skip if you\'re not sure yet'
          : `${selected.length} ${isVisited ? 'visited' : 'on wishlist'}`}
      </p>
    </div>
  )
}

// ─── Step 5: Invite ───────────────────────────────────────────────────────────

function Step5Invite({ data }: { data: OnboardingData }) {
  const [copied, setCopied] = useState(false)
  const profileUrl = `https://bugbitten.com/${data.displayName.toLowerCase().replace(/\s+/g, '')}`

  function copyLink() {
    navigator.clipboard.writeText(profileUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <p className="text-sm text-mist leading-relaxed">
        Your BugBitten profile is ready. Invite friends to follow your journey — the more people following you, the more useful the social features become.
      </p>

      {/* Shareable link */}
      <div className="bg-earth-50 border border-earth-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-earth-800 mb-2 uppercase tracking-wide">Your profile link</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white border border-earth-200 rounded-lg px-3 py-2 text-sm text-earth-700 font-mono truncate">
            {profileUrl}
          </div>
          <button
            type="button"
            onClick={copyLink}
            className={cn(
              'flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-fast',
              copied
                ? 'bg-earth-800 text-white'
                : 'bg-white border border-earth-300 text-earth-700 hover:bg-earth-100'
            )}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Share options */}
      <div className="space-y-3">
        <ShareButton
          icon="f"
          label="Share on Facebook"
          color="#1877F2"
          onClick={() => {
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`, '_blank', 'width=600,height=400')
          }}
        />
        <ShareButton
          icon="w"
          label="Share via WhatsApp"
          color="#25D366"
          onClick={() => {
            const msg = `I just joined BugBitten to document my travels — follow my journey here: ${profileUrl}`
            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
          }}
        />
        <ShareButton
          icon="@"
          label="Invite by email"
          color="#EA4335"
          onClick={() => {
            const subject = encodeURIComponent('Follow my travels on BugBitten')
            const body = encodeURIComponent(`Hey! I just joined BugBitten to document my travels. Follow my journey here: ${profileUrl}`)
            window.location.href = `mailto:?subject=${subject}&body=${body}`
          }}
        />
      </div>

      <p className="text-xs text-center text-mist pt-2">
        You can always invite friends later from Settings → Invite friends
      </p>
    </div>
  )
}

// ─── Share button ─────────────────────────────────────────────────────────────

function ShareButton({
  icon,
  label,
  color,
  onClick,
}: {
  icon:    string
  label:   string
  color:   string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-4 py-3.5 px-4 rounded-xl border border-fog bg-white',
        'hover:bg-haze transition-colors duration-fast text-left active:scale-[0.98]'
      )}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
        style={{ background: color }}
      >
        {icon}
      </div>
      <span className="font-medium text-sm text-ink">{label}</span>
      <span className="ml-auto text-mist text-sm">→</span>
    </button>
  )
}
