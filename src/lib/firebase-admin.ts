import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

let adminApp: App

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}'
  // Dotenv can mangle bare-unquoted JSON (stops at special chars). If the value
  // is tiny (<100 chars) we're almost certainly truncated — fail loudly with guidance.
  if (raw.length < 100) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON looks truncated (len=${raw.length}). Wrap the value in single quotes in .env.local: FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'`)
  }
  // Parse SA JSON - the private key may have literal newlines that need escaping
  let serviceAccount: Record<string, string>
  try {
    serviceAccount = JSON.parse(raw)
  } catch {
    // Fix literal newlines in private_key value
    const fixed = raw.replace(/"private_key"\s*:\s*"([\s\S]*?)"/g, (_: string, k: string) =>
      `"private_key": "${k.replace(/\n/g, '\\n').replace(/\r/g, '')}"`
    )
    serviceAccount = JSON.parse(fixed)
  }
  adminApp = initializeApp({
    credential: cert(serviceAccount as Parameters<typeof cert>[0]),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  })
  return adminApp
}

export const adminAuth = () => getAuth(getAdminApp())
export const getAdminAuth = adminAuth
