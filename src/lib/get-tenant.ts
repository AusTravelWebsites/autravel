import { headers } from 'next/headers'
import { DEFAULT_TENANT, StateCode, TENANTS, TenantConfig, tenantForHost } from './tenants'

/**
 * Server-side helper: returns the current tenant based on the request host.
 *
 * Middleware sets an `x-tenant` header with the resolved state_code for speed,
 * but we also fall back to re-resolving from `host` if the header is missing
 * (e.g. during static generation).
 */
export async function getTenant(): Promise<TenantConfig> {
  const h = await headers()
  const tag = h.get('x-tenant') as StateCode | null
  if (tag && TENANTS[tag]) return TENANTS[tag]
  const host = h.get('host') || h.get('x-forwarded-host')
  return tenantForHost(host)
}

/**
 * Applies the tenant's state filter to a SQL WHERE clause. Returns a clause
 * fragment suitable for interpolating into a postgres.js tagged template.
 *
 * Aggregator tenants (aunz) return an empty filter so they see every state's rows.
 */
export function stateFilterValue(tenant: TenantConfig): StateCode | null {
  return tenant.aggregator ? null : tenant.state_code
}

export function isAggregator(tenant: TenantConfig): boolean {
  return tenant.aggregator
}

/**
 * State codes whose `tours` rows a tenant should surface.
 *  - aggregator (aunz) → null  (no filter; sees every state's tours)
 *  - tenant with explicit tourStateCodes (e.g. perth → ['perth','wa']) → that list
 *  - otherwise → [own state_code]
 *
 * Only the shared single-tenant `tours` table needs this; other tables hold
 * per-tenant rows and use stateFilterValue. Use with `state_code = ANY(${list})`.
 */
export function tourStatesFor(tenant: TenantConfig): StateCode[] | null {
  if (tenant.aggregator) return null
  return tenant.tourStateCodes ?? [tenant.state_code]
}

/**
 * State codes whose `parks` rows a tenant should surface. Like tourStatesFor but
 * for the shared parks table — lets an all-Australia tenant (The Australian
 * Explorer) show every AU state's caravan parks via `state_code = ANY(${list})`.
 *  - aggregator → null (no filter)
 *  - tenant with scopeStates → that list
 *  - otherwise → [own state_code]
 */
export function parkStatesFor(tenant: TenantConfig): StateCode[] | null {
  if (tenant.aggregator) return null
  return tenant.scopeStates ?? [tenant.state_code]
}

export { DEFAULT_TENANT }
