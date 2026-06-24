import type { TenantConfig } from './tenants'

/**
 * Per-tenant copy + theming for the walks/trails explorer.
 *
 * The trails feature (autravel.trails + TrailExplorer + the /park-maps route)
 * was originally built UK-only for the New Forest. It is now driven by
 * `tenant.trailsRoute`: any tenant that sets it exposes the explorer at that
 * public path. This helper keeps all the tenant-specific wording and accent in
 * one place so the route, homepage section and nav read naturally per brand —
 * no hard-coded "New Forest"/teal leaking onto other tenants.
 */
export type TrailsCopy = {
  /** Whether this tenant exposes the trails feature at all. */
  enabled: boolean
  /** Public route base for links + canonicals, e.g. '/walks' or '/park-maps'. */
  base: string
  /** Top-nav + breadcrumb label. */
  navLabel: string
  /** Listing-page H1. */
  h1: string
  /** Listing-page intro paragraph. */
  intro: string
  /** <title> for the listing page. */
  metaTitle: string
  /** Meta description for the listing page. */
  metaDesc: string
  /** Suffix appended to detail-page titles, e.g. 'Perth Tourism'. */
  titleSuffix: string
  /** Prose scope, e.g. 'across Western Australia' / 'across the New Forest'. */
  scope: string
  /** Bare region name, e.g. 'Western Australia' / 'the New Forest'. */
  scopeShort: string
  /** Stat label for the "X waymarked trails" hero figure. */
  // (kept generic in the page; no field needed)
  /** Brand accent for the trails UI (deliberately not teal for new tenants). */
  accent: string
  accentDark: string
  accentLight: string
}

export function trailsCopy(t: TenantConfig): TrailsCopy {
  const base = t.trailsRoute || '/park-maps'

  if (t.state_code === 'uk') {
    return {
      enabled: true,
      base,
      navLabel: 'Park Maps',
      h1: 'New Forest Park Maps',
      intro:
        'Every walk, trail, bridleway and cycle route across the New Forest National Park — each with an interactive route map, distance, estimated time, difficulty and what to expect underfoot. Search and filter to find your next outing.',
      metaTitle: 'New Forest Park Maps — Walks, Trails & Cycle Routes',
      metaDesc:
        'Interactive maps for every walk, trail, bridleway and cycle route in the New Forest National Park. Search by type, distance, difficulty and area — with route maps, distances and what to expect.',
      titleSuffix: 'New Forest Park Maps',
      scope: 'across the New Forest',
      scopeShort: 'the New Forest',
      accent: '#0d9488',
      accentDark: '#0f2e2a',
      accentLight: '#f0fdfa',
    }
  }

  // Generic AU tenants (Perth Tourism + any future trails-first state). Scope
  // copy reads off tenant.stateName so it works for any region.
  const region = t.stateName
  return {
    enabled: !!t.trailsRoute,
    base,
    navLabel: 'Walks & Trails',
    h1: `Walks, Bike Paths & Trails in ${region}`,
    intro:
      `Every walking trail, bike path and cycle route across ${region} — each with an interactive route map, distance, estimated time, difficulty and what to expect underfoot. Search and filter to find your next walk or ride.`,
    metaTitle: `Walks, Bike Paths & Trails in ${region}`,
    metaDesc:
      `Interactive maps for walking trails, bike paths and cycle routes across ${region}. Search by type, distance, difficulty and area — with route maps, distances and what to expect underfoot.`,
    // Feature label, NOT the brand — the root layout already appends "· {tenant.name}"
    // to every title, so using the brand here would double it.
    titleSuffix: 'Walks & Trails',
    scope: `across ${region}`,
    scopeShort: region,
    // WA red-earth ochre — warm, outdoorsy and deliberately not the teal/emerald
    // default (per brand rules). Future tenants can branch here.
    accent: '#b45309',
    accentDark: '#7c2d12',
    accentLight: '#fff7ed',
  }
}
