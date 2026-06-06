'use client'

import { cn } from '@/lib/utils'
import { Avatar, StarRating, GpsBadge, Badge, Card } from '@/components/ui'
import Link from 'next/link'

export interface Review {
  id:            string
  user: {
    id:           string
    username:     string
    displayName:  string
    avatarUrl?:   string
  }
  place?: {
    id:   string
    name: string
    slug: string
  }
  overallRating:    number
  cleanlinessRating?: number
  socialVibeRating?:  number
  valueRating?:       number
  experienceRating?:  number
  nightsStayed?:      number
  travellerType?:     'solo' | 'couple' | 'group' | 'family'
  body:               string
  visitDate?:         string
  gpsVerified:        boolean
  recommendations?:   Array<{ name: string; slug: string }>
  createdAt:          string
}

interface ReviewCardProps {
  review:     Review
  showPlace?: boolean
  className?: string
}

const travellerTypeLabel: Record<NonNullable<Review['travellerType']>, string> = {
  solo:   'Solo traveller',
  couple: 'Couple',
  group:  'Group',
  family: 'Family',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    month: 'long',
    year:  'numeric',
  })
}

export function ReviewCard({ review, showPlace, className }: ReviewCardProps) {
  const subRatings = [
    review.cleanlinessRating && { label: 'Cleanliness', value: review.cleanlinessRating },
    review.socialVibeRating  && { label: 'Social vibe',  value: review.socialVibeRating },
    review.valueRating       && { label: 'Value',         value: review.valueRating },
    review.experienceRating  && { label: 'Experience',    value: review.experienceRating },
  ].filter(Boolean) as Array<{ label: string; value: number }>

  return (
    <Card className={cn('overflow-hidden', className)} padding="none">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <Link href={`/${review.user.username}`}>
              <Avatar
                src={review.user.avatarUrl}
                name={review.user.displayName}
                size="sm"
                className="hover:opacity-90 transition-opacity"
              />
            </Link>
            <div>
              <Link
                href={`/${review.user.username}`}
                className="font-medium text-ink text-sm hover:text-earth-800 transition-colors"
              >
                {review.user.displayName}
              </Link>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                {review.travellerType && (
                  <span className="text-xs text-mist">
                    {travellerTypeLabel[review.travellerType]}
                  </span>
                )}
                {review.nightsStayed && (
                  <span className="text-xs text-mist">
                    · {review.nightsStayed} night{review.nightsStayed > 1 ? 's' : ''}
                  </span>
                )}
                {review.visitDate && (
                  <span className="text-xs text-mist">
                    · {formatDate(review.visitDate)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* GPS verified badge */}
          {review.gpsVerified && <GpsBadge verified className="flex-shrink-0" />}
        </div>

        {/* Place (if shown) */}
        {showPlace && review.place && (
          <Link
            href={`/places/${review.place.slug}`}
            className="block text-xs text-earth-700 font-medium mb-2 hover:text-earth-800 transition-colors"
          >
            Re: {review.place.name}
          </Link>
        )}

        {/* Overall rating */}
        <div className="mb-3">
          <StarRating
            rating={review.overallRating}
            size="md"
            showNum
          />
        </div>

        {/* Sub-ratings */}
        {subRatings.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
            {subRatings.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-mist">{label}</span>
                <SubRatingBar value={value} />
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <p className="text-sm text-slate leading-relaxed mb-3">
          {review.body}
        </p>

        {/* Recommendations */}
        {review.recommendations && review.recommendations.length > 0 && (
          <div>
            <p className="text-xs font-medium text-mist uppercase tracking-wide mb-1.5">
              Recommended nearby
            </p>
            <div className="flex flex-wrap gap-1.5">
              {review.recommendations.map(rec => (
                <Link key={rec.slug} href={`/places/${rec.slug}`}>
                  <span className="inline-flex items-center gap-1 bg-sand-100 text-amber-800 border border-sand-500/30 text-xs font-medium px-2.5 py-1 rounded hover:bg-sand-500/20 transition-colors cursor-pointer">
                    {rec.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── Sub-rating bar ──────────────────────────────────────────────────────────

function SubRatingBar({ value }: { value: number }) {
  const pct = (value / 5) * 100

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-fog rounded-full overflow-hidden">
        <div
          className="h-full bg-earth-500 rounded-full transition-all duration-slow"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-earth-800 w-4 text-right">
        {value}
      </span>
    </div>
  )
}

// ─── Review skeleton ─────────────────────────────────────────────────────────

export function ReviewCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('overflow-hidden', className)} padding="none">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-fog animate-pulse flex-shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3.5 bg-fog animate-pulse rounded w-24" />
            <div className="h-3 bg-fog animate-pulse rounded w-32" />
          </div>
        </div>
        <div className="h-4 bg-fog animate-pulse rounded w-20 mb-3" />
        <div className="space-y-2">
          <div className="h-3.5 bg-fog animate-pulse rounded w-full" />
          <div className="h-3.5 bg-fog animate-pulse rounded w-5/6" />
          <div className="h-3.5 bg-fog animate-pulse rounded w-4/6" />
        </div>
      </div>
    </Card>
  )
}

// ─── Write review prompt ─────────────────────────────────────────────────────

interface WriteReviewPromptProps {
  placeId:         string
  hasValidCheckin: boolean
  className?:      string
}

export function WriteReviewPrompt({ placeId, hasValidCheckin, className }: WriteReviewPromptProps) {
  if (!hasValidCheckin) {
    return (
      <div className={cn(
        'border-2 border-dashed border-fog rounded-lg p-6 text-center',
        className
      )}>
        <p className="text-sm font-medium text-slate mb-1">Check in first</p>
        <p className="text-xs text-mist mb-3">
          You need to check in within 5 km to leave a verified review
        </p>
        <GpsBadge className="inline-flex" />
      </div>
    )
  }

  return (
    <Link
      href={`/reviews/new?place=${placeId}`}
      className={cn(
        'block border border-earth-100 bg-earth-50 rounded-lg p-4',
        'hover:bg-earth-100 transition-colors duration-fast cursor-pointer group',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-earth-100 group-hover:bg-earth-200 transition-colors flex items-center justify-center flex-shrink-0">
          <PenIcon />
        </div>
        <div>
          <p className="text-sm font-medium text-earth-800">Share your experience</p>
          <p className="text-xs text-earth-700">Write a verified review · GPS check-in confirmed</p>
        </div>
      </div>
    </Link>
  )
}

function PenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-earth-700">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}
