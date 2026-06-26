// Auto-derived sub-menu for a destination — drives the chip-bar nav that
// appears on `/<destination>/` and every `/<destination>/<subpath>/` article.
//
// 2026-06-26 — built to match the original qldtravel sub-menu pattern recovered
// from Wayback. Per Craig: location pages should not look like a blog. Every
// page within a destination shows the same nav so users always know what else
// exists in that destination.
import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'
import type { StateCode } from '@/lib/tenants'

export type SubMenuItem = {
  label: string
  href: string
  isOverview?: boolean
  isCurrent?: boolean
  /** Number of articles grouped under this top-level segment (for grouped layout) */
  count?: number
}

const TITLE_CASE_OVERRIDES: Record<string, string> = {
  // Lowercase words that should stay lowercase in titles ("Holidays with Kids")
  'with': 'with', 'in': 'in', 'and': 'and', 'or': 'or', 'on': 'on', 'of': 'of', 'for': 'for', 'a': 'a', 'an': 'an', 'the': 'the',
  // Acronyms / brands
  '4wd': '4WD', 'b&b': 'B&B', 'bb': 'B&B', 'rv': 'RV', 'yha': 'YHA',
}
/** Strip a trailing legacy file extension (.html/.htm/.php) so it never leaks
 *  into labels or defeats the category regexes' `(?:-|$)` word boundaries. */
function stripExt(segment: string): string {
  return segment.replace(/\.(html?|php|aspx?)$/i, '')
}
function labelFor(segment: string): string {
  return stripExt(segment).split('-').map((w, i) => {
    const lower = w.toLowerCase()
    if (TITLE_CASE_OVERRIDES[lower] !== undefined) {
      return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : TITLE_CASE_OVERRIDES[lower]
    }
    if (lower === w.toLowerCase() && /^[a-z0-9]+$/.test(w)) {
      return w.charAt(0).toUpperCase() + w.slice(1)
    }
    return w
  }).join(' ')
}

async function fetchSubMenuRaw(destSlug: string, state: StateCode | null) {
  try {
    const rows = await db<Array<{ legacy_path: string; title: string }>>`
      SELECT legacy_path, title FROM autravel.articles
       WHERE status = 'published'
         AND (${state}::text IS NULL OR state_code = ${state}::text)
         AND legacy_path LIKE ${'/' + destSlug + '/%'}
         AND legacy_path <> ${'/' + destSlug + '/'}
       ORDER BY legacy_path ASC`
    return rows
  } catch { return [] }
}

export type SubMenuGroup = {
  /** First-segment label (e.g. "Accommodation") — null for top-level items */
  group: string | null
  items: SubMenuItem[]
}

// Top-level grouping categories. A segment matching the regex gets routed
// into that group's label. Lower priority numbers win when multiple match.
const CATEGORY_RULES: Array<{ label: string; re: RegExp; priority: number }> = [
  { label: 'Accommodation', re: /(?:^|-)(accommodation|accom|hotels?|motels?|apartments?|resorts?|cabins?|backpackers?|holiday-park|caravan-park|lodges?|bnb|b-and-b|self-contained|luxury|budget|family|beachfront|hostels?|guesthouses?|villas?|stay|stays|inn|inns)(?:-|$)/i, priority: 1 },
  { label: 'Activities',    re: /(?:^|-)(activities|things-to-do|attractions|sightseeing|adventure|water-sports|fishing|surfing|snorkel|diving|kayaking|hiking|bushwalking|whale-watching|wildlife|nature|golf|beach|park|wineries|theme-parks)(?:-|$)/i, priority: 2 },
  { label: 'Tours',         re: /(?:^|-)(tours?|day-tours?|trips?|cruises?|sightseeing-tours|adventure-tours|safaris?|expeditions?)(?:-|$)/i, priority: 3 },
  { label: 'Transport & hire', re: /(?:^|-)(transfers?|shuttles?|airport-shuttle|rentals?|car-hire|car-rental|transport|campervans?|motorhomes?|4wd|hire|apollo|britz|jucy|maui|hertz|avis|budget-rentals|thrifty|europcar|trains?|buses?|ferry|ferries|flights?)(?:-|$)/i, priority: 4 },
  { label: 'Dining',        re: /(?:^|-)(dining|restaurants?|cafes?|food|culinary|bars?|breweries?|wine|eat|eating|coffee)(?:-|$)/i, priority: 5 },
  { label: 'Holidays',      re: /(?:^|-)(holidays?|holidays-with-kids|kids|family|weddings?|honeymoon|specials?|deals?|packages?|getaways?)(?:-|$)/i, priority: 6 },
  { label: 'Travel guide',  re: /(?:^|-)(travel-guide|guide|map|info|information|history|tips|planning|weather)(?:-|$)/i, priority: 7 },
]
// Minimum items required for a non-rule-matched group to survive on its own.
// Smaller stragglers fold into a "More" bucket.
const MIN_GROUP_SIZE = 3

function categoryFor(segment: string): { label: string; priority: number } {
  for (const r of CATEGORY_RULES) {
    if (r.re.test(segment)) return { label: r.label, priority: r.priority }
  }
  // Use a title-case form of the segment itself as a fallback group
  return { label: labelFor(segment), priority: 100 }
}

/**
 * Returns the sub-menu for a destination. Auto-derives items from articles
 * under /<destSlug>/<...>/. Smart grouping handles BOTH:
 *   - clean nested paths like /maroochydore/accommodation/apartments/
 *   - flat top-level slugs like /maroochydore/maroochydore-backpackers-accommodation/
 * The second pattern gets normalised (destination prefix stripped) and routed
 * to the appropriate category (Accommodation, Dining, Tours, etc).
 */
export function getDestinationSubMenu(destSlug: string, state: StateCode | null) {
  return unstable_cache(
    async (): Promise<SubMenuGroup[]> => {
      const rows = await fetchSubMenuRaw(destSlug, state)
      if (rows.length === 0) return []

      // Group bucket → items
      const groupMap = new Map<string, { priority: number; items: SubMenuItem[] }>()

      for (const r of rows) {
        const trimmed = r.legacy_path.replace(/^\/+|\/+$/g, '').split('/')
        const segs = trimmed.slice(1) // drop the destination segment
        if (segs.length === 0) continue

        // Strip the destination name from any segment that starts with it
        // (e.g. "maroochydore-backpackers-accommodation" → "backpackers-accommodation")
        const cleanSegs = segs.map(s => {
          const lower = s.toLowerCase()
          if (lower === destSlug) return ''
          if (lower.startsWith(destSlug + '-')) return stripExt(s.slice(destSlug.length + 1))
          return stripExt(s)
        }).filter(Boolean)
        if (cleanSegs.length === 0) continue

        const leafSeg = cleanSegs[cleanSegs.length - 1]
        // Skip junk pages (transfers/transfers/, etc — leaf same as parent)
        if (cleanSegs.length >= 2 && cleanSegs[cleanSegs.length - 2] === leafSeg) continue

        const label = labelFor(leafSeg)
        // Determine category — try each segment, deeper segments take priority
        // (so /accommodation/luxury/ uses Accommodation, not the leaf word).
        // Seed at priority 100 (uncategorised) so a slug that matches no rule
        // folds into the "More" bucket instead of surviving as its own group.
        let cat = { label: labelFor(cleanSegs[0]), priority: 100 }
        for (const seg of cleanSegs) {
          const c = categoryFor(seg)
          if (c.priority < cat.priority) cat = c
        }

        const item: SubMenuItem = { label, href: r.legacy_path }
        if (!groupMap.has(cat.label)) groupMap.set(cat.label, { priority: cat.priority, items: [] })
        groupMap.get(cat.label)!.items.push(item)
      }

      // Merge tiny non-categorised groups into a single "More" bucket so we
      // don't end up with 8 single-item "groups" beside Accommodation.
      const moreItems: SubMenuItem[] = []
      const finalGroups: Array<{ label: string; priority: number; items: SubMenuItem[] }> = []
      for (const [groupLabel, { priority, items }] of groupMap.entries()) {
        // A "real" category match (priority < 100) keeps its own group regardless of size.
        if (priority < 100 || items.length >= MIN_GROUP_SIZE) {
          finalGroups.push({ label: groupLabel, priority, items })
        } else {
          moreItems.push(...items)
        }
      }
      if (moreItems.length > 0) finalGroups.push({ label: 'More', priority: 99, items: moreItems })

      const groups: SubMenuGroup[] = []
      // First entry: the destination overview itself
      groups.push({ group: null, items: [{ label: 'Overview', href: `/${destSlug}/`, isOverview: true }] })

      // Sort by category priority (Accommodation first, etc.), then size
      finalGroups.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority
        return b.items.length - a.items.length
      })
      for (const { label, items } of finalGroups) {
        // De-dup + sort
        const dedup = Array.from(new Map(items.map(i => [i.href, i])).values())
        dedup.sort((a, b) => a.label.localeCompare(b.label))
        groups.push({ group: label, items: dedup, count: dedup.length } as any)
      }
      return groups
    },
    ['dest-submenu', 'v4', destSlug, state ?? 'all'],
    { revalidate: 600, tags: ['articles', `articles:${state ?? 'all'}`, `dest:${destSlug}`] }
  )()
}

/** Total item count across all groups (excluding overview). */
export function countSubMenuItems(groups: SubMenuGroup[]): number {
  return groups.slice(1).reduce((a, g) => a + g.items.length, 0)
}

/** Detect the destination slug from a legacy_path (first segment that matches a destination). */
export async function detectDestinationSlug(legacyPath: string | null | undefined, state: StateCode | null): Promise<string | null> {
  if (!legacyPath) return null
  const first = legacyPath.replace(/^\/+/, '').split('/')[0]
  if (!first) return null
  try {
    const [row] = await db<Array<{ slug: string }>>`
      SELECT slug FROM autravel.destinations
       WHERE active = true
         AND (${state}::text IS NULL OR state_code = ${state}::text)
         AND slug = ${first.toLowerCase()}
       LIMIT 1`
    return row?.slug ?? null
  } catch { return null }
}
