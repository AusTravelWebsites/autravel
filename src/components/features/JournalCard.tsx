'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Avatar, Badge, Card } from '@/components/ui'

export interface JournalEntry {
  id:          string
  user: {
    id:           string
    username:     string
    displayName:  string
    avatarUrl?:   string
    travelStatus: 'travelling' | 'planning' | 'home'
  }
  trip?: {
    id:    string
    title: string
    slug:  string
  }
  title?:       string
  body:         string
  locationName?: string
  place_name?: string
  place_slug?: string
  mediaUrls?:   string[]
  likeCount:    number
  commentCount: number
  isLiked?:     boolean
  postedAt:     string  // ISO string
}

interface JournalCardProps {
  style?: React.CSSProperties
  style?: React.CSSProperties
  entry:      JournalEntry
  onLike?:    (id: string) => void
  onComment?: (id: string) => void
  onShare?:   (id: string) => void
  compact?:   boolean
  className?: string
}

const travelStatusVariant: Record<string, 'travel' | 'planning' | 'home'> = {
  travelling: 'travel',
  planning:   'planning',
  home:       'home',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(mins  / 60)
  const days  = Math.floor(hours / 24)
  if (mins  < 1)   return 'just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  if (days  < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function JournalCard({
  entry,
  onLike,
  onComment,
  onShare,
  compact,
  className,
}: JournalCardProps) {
  const [liked, setLiked]     = useState(entry.isLiked ?? false)
  const [likeCount, setCount] = useState(entry.likeCount)

  function handleLike() {
    setLiked(prev => {
      const next = !prev
      setCount(c => next ? c + 1 : c - 1)
      onLike?.(entry.id)
      return next
    })
  }

  const variant = travelStatusVariant[entry.user.travelStatus] ?? 'home'

  return (
    <Card
      className={cn(
        'overflow-hidden bb-animate-fade-up',
        className
      )}
      padding="none"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/${entry.user.username}`} className="flex-shrink-0">
            <Avatar
              src={entry.user.avatarUrl}
              name={entry.user.displayName}
              size="md"
              className="hover:opacity-90 transition-opacity duration-fast"
            />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/${entry.user.username}`}
                className="font-medium text-ink hover:text-earth-800 transition-colors duration-fast text-sm"
              >
                {entry.user.displayName}
              </Link>
              <span className="text-mist text-xs">{timeAgo(entry.postedAt)}</span>
            </div>
            {entry.trip && (
              <Link
                href={`/${entry.user.username}/trips/${entry.trip.slug}`}
                className="text-xs text-earth-700 hover:text-earth-800 transition-colors"
              >
                {entry.trip.title}
              </Link>
            )}
          </div>
        </div>
        <Badge variant={variant} dot className="flex-shrink-0">
          {entry.user.travelStatus === 'travelling' ? 'Travelling'
            : entry.user.travelStatus === 'planning' ? 'Planning'
            : 'At home'}
        </Badge>
      </div>

        {/* Location link */}
        {(entry.place_name || entry.locationName) && (
          <div style={{padding:'0 16px 8px'}}>
            {entry.place_slug ? (
              <a href={`/places/${entry.place_slug}`} style={{display:'inline-flex',alignItems:'center',background:'var(--brand-light)',color:'var(--brand)',border:'1px solid #99f6e4',borderRadius:'99px',padding:'2px 10px',fontSize:'12px',fontWeight:600,textDecoration:'none'}}>
                {entry.place_name || entry.locationName}
              </a>
            ) : (
              <span style={{fontSize:'12px',color:'#6b7280'}}>{entry.place_name || entry.locationName}</span>
            )}
          </div>
        )}

      {/* Title */}
      {entry.title && (
        <h2 className={cn(
          'px-4 font-display font-semibold text-ink tracking-[-0.01em]',
          compact ? 'text-base pb-1' : 'text-lg pb-1.5'
        )}>
          {entry.title}
        </h2>
      )}

      {/* Body */}
      <p className={cn(
        'px-4 text-slate leading-relaxed',
        compact ? 'text-sm line-clamp-3 pb-3' : 'text-base pb-3',
        entry.mediaUrls?.length && 'pb-2'
      )}>
        {entry.body}
      </p>

      {/* Media */}
      {!compact && entry.mediaUrls && entry.mediaUrls.length > 0 && (
        <div className={cn(
          'px-4 pb-3',
          entry.mediaUrls.length === 1 ? 'grid grid-cols-1' : 'grid grid-cols-2 gap-1.5'
        )}>
          {entry.mediaUrls.slice(0, 4).map((url, i) => (
            <div
              key={i}
              className={cn(
                'relative overflow-hidden bg-earth-50',
                'rounded-md',
                entry.mediaUrls!.length === 1 ? 'aspect-[16/9]' : 'aspect-square',
                i === 3 && entry.mediaUrls!.length > 4 && 'relative'
              )}
            >
              <img
                src={url}
                alt={`Photo ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {i === 3 && entry.mediaUrls!.length > 4 && (
                <div className="absolute inset-0 bg-ink/50 flex items-center justify-center">
                  <span className="text-white font-semibold text-lg">
                    +{entry.mediaUrls!.length - 4}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 py-2.5 border-t border-fog">
        {/* Like */}
        <button
          onClick={handleLike}
          aria-label={liked ? 'Unlike' : 'Like'}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm',
            'transition-all duration-fast ease-out',
            'hover:bg-haze active:scale-[0.97]',
            liked ? 'text-earth-800 font-medium' : 'text-ash hover:text-slate'
          )}
        >
          <span className={cn('text-base leading-none', liked && 'animate-scale-in')}>
            {liked ? '♥' : '♡'}
          </span>
          <span>{likeCount.toLocaleString()}</span>
        </button>

        {/* Comment */}
        <button
          onClick={() => onComment?.(entry.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-ash hover:text-slate hover:bg-haze transition-all duration-fast active:scale-[0.97]"
        >
          <CommentIcon />
          <span>{entry.commentCount.toLocaleString()}</span>
        </button>

        <div className="flex-1" />

        {/* Share */}
        <button
          onClick={() => onShare?.(entry.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-earth-700 font-medium hover:bg-earth-50 transition-all duration-fast active:scale-[0.97]"
        >
          <ShareIcon />
          Share
        </button>
      </div>
    </Card>
  )
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

export function JournalCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('overflow-hidden', className)} padding="none">
      <div className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-fog animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-fog animate-pulse rounded w-32" />
          <div className="h-3 bg-fog animate-pulse rounded w-20" />
        </div>
      </div>
      <div className="px-4 pb-3 space-y-2">
        <div className="h-5 bg-fog animate-pulse rounded w-3/4" />
        <div className="h-3.5 bg-fog animate-pulse rounded w-full" />
        <div className="h-3.5 bg-fog animate-pulse rounded w-5/6" />
        <div className="h-3.5 bg-fog animate-pulse rounded w-4/6" />
      </div>
      <div className="h-48 bg-fog animate-pulse mx-4 mb-3 rounded-md" />
      <div className="flex items-center gap-4 px-4 py-3 border-t border-fog">
        <div className="h-4 bg-fog animate-pulse rounded w-12" />
        <div className="h-4 bg-fog animate-pulse rounded w-12" />
      </div>
    </Card>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function CommentIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  )
}
