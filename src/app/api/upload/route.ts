import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { getAdminAuth } from '@/lib/firebase-admin'
import { rateLimit, getIP } from '@/lib/admin'
import sql from '@/lib/db'

const ALLOWED_FOLDERS = new Set([
  'avatars','cover','journal','reviews','trips','places','meetup','meetup-gallery','blog','general'
])

async function getViewer(req: NextRequest) {
  const s = req.cookies.get('__session')?.value
  if (!s) return null
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true)
    const [u] = await sql`SELECT id::text AS id, is_banned FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`
    if (!u || u.is_banned) return null
    return u
  } catch { return null }
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!
const PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN!
const MAX_WIDTH = 1280
const MAX_FILE_MB = 10

export async function POST(req: NextRequest) {
  try {
    const viewer = await getViewer(req)
    if (!viewer) return NextResponse.json({ error: 'Sign in to upload' }, { status: 401 })
    const ip = getIP(req) || 'unknown'
    if (!(await rateLimit(`upload:${viewer.id}`, 60, 3600))) {
      return NextResponse.json({ error: 'Too many uploads — try later' }, { status: 429 })
    }
    if (!(await rateLimit(`upload-ip:${ip}`, 200, 3600))) {
      return NextResponse.json({ error: 'Too many uploads from your network' }, { status: 429 })
    }

    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Must be multipart/form-data' }, { status: 400 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folderRaw = (formData.get('folder') as string) || 'general'
    // Allowlist folder, reject path traversal
    const folder = ALLOWED_FOLDERS.has(folderRaw) ? folderRaw : 'general'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Only image files are accepted (JPEG, PNG, WebP, GIF, HEIC)' }, { status: 400 })
    }

    // Validate file size (10MB max)
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      return NextResponse.json({ error: `File too large. Maximum size is ${MAX_FILE_MB}MB` }, { status: 400 })
    }

    // Read raw bytes
    const rawBuffer = Buffer.from(await file.arrayBuffer())

    // Get original metadata before processing
    const meta = await sharp(rawBuffer).metadata()
    const originalWidth = meta.width ?? 0
    const originalSize = rawBuffer.length

    // Process with Sharp:
    // 1. Resize to max 1280px wide (maintain aspect ratio, never upscale)
    // 2. Convert to WebP
    // 3. Optimise: 1280px wide, WebP quality 75, effort 6 (max compression, ~50-70% smaller)
    const processedBuffer = await sharp(rawBuffer)
      .rotate() // auto-rotate based on EXIF orientation
      .resize({
        width: MAX_WIDTH,
        withoutEnlargement: true, // never upscale smaller images
        fit: 'inside',
      })
      .webp({ quality: 75, effort: 6, smartSubsample: true })
      .toBuffer()

    const processedSize = processedBuffer.length
    const savedPct = Math.round((1 - processedSize / originalSize) * 100)

    // Generate unique key: folder/uuid.webp
    const key = `${folder}/${randomUUID()}.webp`

    // Upload to R2
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: processedBuffer,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }))

    const url = `${PUBLIC_DOMAIN}/${key}`

    return NextResponse.json({
      success: true,
      url,
      key,
      stats: {
        originalWidth,
        outputWidth: Math.min(originalWidth, MAX_WIDTH),
        originalSize: Math.round(originalSize / 1024),
        processedSize: Math.round(processedSize / 1024),
        savedPercent: savedPct,
        format: 'webp',
      }
    })

  } catch (err) {
    console.error('[upload error]', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
