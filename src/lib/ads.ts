import { db } from '@/lib/db'

/** The four hand-placed positions, mirroring stkp-ads.php on stkildapenguins. */
export type AdPlacement = 'in_article_1' | 'in_article_2' | 'content_end' | 'home_mid'
export type AdSlots = Partial<Record<AdPlacement, { slot: string; client: string }>>

/**
 * Configured slots for a tenant. A missing row, an inactive row or an empty
 * slot_id all mean "render nothing", so the ad code is safe to deploy before any
 * slot exists — and a placement can be pulled from the DB without a deploy.
 * Never throws: an ad lookup must not be able to take an article page down.
 */
export async function getAdSlots(stateCode: string): Promise<AdSlots> {
  try {
    const rows = await db<{ placement: AdPlacement; slot_id: string; ad_client: string }[]>`
      SELECT placement, slot_id, ad_client FROM site_ad_slots
       WHERE state_code = ${stateCode} AND is_active = true AND slot_id <> ''`
    const out: AdSlots = {}
    for (const r of rows) {
      const slot = r.slot_id.replace(/\D/g, '')
      if (slot) out[r.placement] = { slot, client: r.ad_client }
    }
    return out
  } catch {
    return {}
  }
}

/**
 * One ad unit, as an HTML string so it can be spliced into body_html.
 *
 * The height is reserved by the wrapper BEFORE the ad loads, which is the whole
 * point — Auto ads shifted these pages because nothing reserved their space. A
 * fixed `rectangle` format with data-full-width-responsive="false" keeps the
 * rendered height predictable at <=280px inside a 300px box.
 */
export function adUnitHtml(slots: AdSlots, placement: AdPlacement): string {
  const cfg = slots[placement]
  if (!cfg) return ''
  return `<div class="at-ad" data-placement="${placement}">`
    + `<span class="at-ad-label">Advertisement</span>`
    + `<ins class="adsbygoogle" style="display:block;width:100%;height:280px"`
    + ` data-ad-client="${cfg.client}" data-ad-slot="${cfg.slot}"`
    + ` data-ad-format="rectangle" data-full-width-responsive="false"></ins>`
    + `<script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>`
    + `</div>`
}
