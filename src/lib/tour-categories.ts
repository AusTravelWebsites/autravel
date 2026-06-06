// Canonical tour-category taxonomy. Must stay in sync with scripts/categorize-tours.mjs.
// If you add/rename a category here, re-classify with: node --env-file=.env.local scripts/categorize-tours.mjs --force

export type TourCategory = {
  slug: string
  label: string
  emoji: string
}

export const TOUR_CATEGORIES: TourCategory[] = [
  { slug: 'food-cooking',     label: 'Food & Cooking',          emoji: '🍜' },
  { slug: 'culture-history',  label: 'Culture & History',       emoji: '🛕' },
  { slug: 'nature-wildlife',  label: 'Nature & Wildlife',       emoji: '🌿' },
  { slug: 'adventure-sports', label: 'Adventure & Sports',      emoji: '🏔' },
  { slug: 'water-activities', label: 'Water Activities',        emoji: '🐠' },
  { slug: 'wellness-spa',     label: 'Wellness & Spa',          emoji: '🧖' },
  { slug: 'day-trips',        label: 'Day Trips & Sightseeing', emoji: '🚌' },
  { slug: 'transfers',        label: 'Transfers',               emoji: '✈️' },
  { slug: 'nightlife',        label: 'Nightlife',               emoji: '🍹' },
  { slug: 'shopping-markets', label: 'Shopping & Markets',      emoji: '🛍' },
]

export const CATEGORY_BY_SLUG: Record<string, TourCategory> = Object.fromEntries(TOUR_CATEGORIES.map(c => [c.slug, c]))
