'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button, Card, StarRating, Avatar, GpsBadge, Badge } from '@/components/ui'

export interface Place {
  id:             string
  googlePlaceId:  string
  slug:           string
  name:           string
  address:        string
  city:           string
  countryCode:    string
  category:       'hostel' | 'hotel' | 'attraction' | 'food' | 'nightlife' | 'nature'
  googleRating:   number
  bbRating?:      number
  bbReviewCount?: number
  googlePhotoUrl?: string
  priceRange?:    '$' | '$$' | '$$$'
  isOpen?:        boolean
}

interface PlaceCardProps {
  place:       Place
  distanceKm?: number
  variant?:    'default' | 'compact' | 'featured'
  className?:  string
  recentVisitors?: Array<{ name: string; avatarUrl?: string }>
}

const categoryEmoji: Record<Place['category'], string> = {
  hostel:     '🏨',
  hotel:      '🏩',
  attraction: '🗺',
  food:       '🍜',
  nightlife:  '🍻',
  nature:     '🌿',
}

const categoryLabel: Record<Place['category'], string> = {
  hostel:     'Hostel',
  hotel:      'Hotel',
  attraction: 'Attraction',
  food:       'Restaurant',
  nightlife:  'Bar / nightlife',
  nature:     'Nature',
}

export function PlaceCard({
  place,
  distanceKm,
  variant = 'default',
  className,
  recentVisitors = [],
}: PlaceCardProps) {
  const withinRange = distanceKm !== undefined && distanceKm <= 5
  const canReview   = withinRange // real check also needs a valid check_in

  if (variant === 'compact') {
    return (
      <Link href={`/places/${place.slug}`}>
        <Card hover className={cn('flex items-center gap-3', className)}>
          <div className="w-12 h-12 rounded-lg bg-earth-50 flex items-center justify-center text-2xl flex-shrink-0">
            {categoryEmoji[place.category]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-ink text-sm truncate">{place.name}</p>
            <p className="text-xs text-mist truncate">{place.city}</p>
          </div>
          {place.bbRating && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-sand-700 text-sm">★</span>
              <span className="text-sm font-semibold text-earth-800">{place.bbRating.toFixed(1)}</span>
            </div>
          )}
        </Card>
      </Link>
    )
  }

  return (
    <Card className={cn('overflow-hidden', className)} padding="none">
      {/* Hero image / emoji */}
      <div className="relative h-36 bg-gradient-to-br from-earth-50 to-sky-100 flex items-center justify-center overflow-hidden">
        {place.googlePhotoUrl ? (
          <img
            src={place.googlePhotoUrl}
            alt={place.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-5xl">{categoryEmoji[place.category]}</span>
        )}

        {/* Category badge */}
        <div className="absolute top-3 left-3">
          <span className="bg-white/90 backdrop-blur-sm text-earth-800 text-xs font-semibold px-2.5 py-1 rounded uppercase tracking-wide border border-earth-100">
            {categoryLabel[place.category]}
          </span>
        </div>

        {/* Open/closed */}
        {place.isOpen !== undefined && (
          <div className="absolute top-3 right-3">
            <span className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              place.isOpen
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            )}>
              {place.isOpen ? 'Open' : 'Closed'}
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        {/* Name + rating */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <Link href={`/places/${place.slug}`}>
            <h3 className="font-display font-semibold text-ink text-lg leading-tight hover:text-earth-800 transition-colors duration-fast">
              {place.name}
            </h3>
          </Link>
          {place.priceRange && (
            <span className="text-xs text-mist flex-shrink-0 mt-1">{place.priceRange}</span>
          )}
        </div>

        <p className="text-xs text-mist mb-3">{place.city}, {place.countryCode}</p>

        {/* Ratings row */}
        <div className="flex items-center gap-3 mb-3">
          {place.bbRating && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-earth-800 bg-earth-50 px-1.5 py-0.5 rounded">
                {place.bbRating.toFixed(1)}
              </span>
              <StarRating rating={place.bbRating} size="sm" />
              {place.bbReviewCount && (
                <span className="text-xs text-mist">
                  {place.bbReviewCount.toLocaleString()} BB
                </span>
              )}
            </div>
          )}
          {place.googleRating && (
            <span className="text-xs text-mist">
              Google: {place.googleRating.toFixed(1)} ★
            </span>
          )}
        </div>

        {/* Recent visitors */}
        {recentVisitors.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex -space-x-1.5">
              {recentVisitors.slice(0, 4).map((v, i) => (
                <Avatar
                  key={i}
                  src={v.avatarUrl}
                  name={v.name}
                  size="xs"
                  className="ring-1.5 ring-white"
                />
              ))}
            </div>
            <span className="text-xs text-mist">
              {recentVisitors.length > 4
                ? `${recentVisitors.length} recent visitors`
                : `${recentVisitors.length} BugBitten travellers visited`}
            </span>
          </div>
        )}

        {/* GPS check-in gate */}
        {distanceKm !== undefined && (
          <div className={cn(
            'rounded-md p-3 mb-3 flex items-center justify-between gap-3',
            withinRange
              ? 'bg-earth-50 border border-earth-100'
              : 'bg-haze border border-fog'
          )}>
            <div className="flex items-center gap-2">
              <GpsBadge distance={`${distanceKm.toFixed(1)} km`} />
              <span className="text-xs text-slate">
                {withinRange
                  ? 'Check in to leave a review'
                  : `${(distanceKm - 5).toFixed(1)} km outside range`}
              </span>
            </div>
            {withinRange && (
              <Link href={`/check-in?place=${place.id}`}>
                <Button size="sm" className="flex-shrink-0 text-xs py-1.5">
                  Check in
                </Button>
              </Link>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Link href={`/places/${place.slug}`} className="flex-1">
            <Button variant="ghost" size="sm" className="w-full">
              View all reviews
            </Button>
          </Link>
          {canReview && (
            <Link href={`/reviews/new?place=${place.id}`} className="flex-1">
              <Button size="sm" className="w-full">
                Write review
              </Button>
            </Link>
          )}
        </div>
      </div>
    </Card>
  )
}

// ─── GPS check-in banner (used inline on place pages) ────────────────────────

interface CheckInBannerProps {
  placeId:    string
  placeName:  string
  distanceKm?: number
  hasValidCheckin?: boolean
}

export function CheckInBanner({
  placeId,
  placeName,
  distanceKm,
  hasValidCheckin,
}: CheckInBannerProps) {
  if (hasValidCheckin) {
    return (
      <div className="bg-earth-50 border border-earth-100 rounded-lg p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <GpsBadge verified />
          <div>
            <p className="text-sm font-medium text-earth-800">Review window open</p>
            <p className="text-xs text-earth-700">Your check-in is valid for 72 hours</p>
          </div>
        </div>
        <Link href={`/reviews/new?place=${placeId}`}>
          <Button size="sm">Write review</Button>
        </Link>
      </div>
    )
  }

  const withinRange = distanceKm !== undefined && distanceKm <= 5

  if (distanceKm === undefined) {
    return (
      <div className="bg-haze border border-fog rounded-lg p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate">Want to review {placeName}?</p>
          <p className="text-xs text-mist">Enable location to check if you're nearby</p>
        </div>
        <Link href={`/check-in?place=${placeId}`}>
          <Button variant="ghost" size="sm">Enable GPS</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-lg p-4 flex items-center justify-between gap-4',
      withinRange
        ? 'bg-earth-50 border border-earth-100'
        : 'bg-haze border border-fog'
    )}>
      <div className="flex items-center gap-2.5">
        <GpsBadge distance={`${distanceKm.toFixed(1)} km`} />
        <div>
          <p className="text-sm font-medium text-slate">
            {withinRange ? 'You\'re close enough to check in' : 'Too far away to review'}
          </p>
          <p className="text-xs text-mist">
            {withinRange
              ? 'Check in to unlock your 72-hour review window'
              : `Reviews require being within 5 km of this place`}
          </p>
        </div>
      </div>
      {withinRange && (
        <Link href={`/check-in?place=${placeId}`}>
          <Button size="sm">Check in here</Button>
        </Link>
      )}
    </div>
  )
}
