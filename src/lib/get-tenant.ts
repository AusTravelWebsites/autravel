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

export { DEFAULT_TENANT }
