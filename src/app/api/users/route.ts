import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api-errors'
import { getAdminAuth } from '@/lib/firebase-admin'
import { db } from '@/lib/db'
import { stripExternalLinks } from '@/lib/sanitize'
async function getUser(req: NextRequest) {
  const session=req.cookies.get('__session')?.value
  if(!session)return null
  try{const decoded=await getAdminAuth().verifySessionCookie(session,true);const rows=await db`SELECT id,is_banned FROM users WHERE firebase_uid=${decoded.uid} LIMIT 1`;return rows[0]??null}catch {return null}
}
export async function GET(req: NextRequest) {
  const sp2 = new URL(req.url).searchParams
  if (sp2.get('suggested') === '1') {
    const user = await getUser(req)
    const limit = Math.min(parseInt(sp2.get('limit') ?? '20'), 50)
    try {
      if (user) {
        const users = await db`
          SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.last_seen_at, u.verification_status, u.home_country
          FROM users u
          WHERE u.id::text != ${user.id}::text
          AND u.id::text NOT IN (SELECT following_id FROM follows WHERE follower_id = ${user.id}::text)
          ORDER BY u.created_at DESC LIMIT ${limit}`
        return NextResponse.json({ users })
      } else {
        const users = await db`SELECT id, username, display_name, avatar_url, bio, last_seen_at, verification_status, home_country FROM users ORDER BY created_at DESC LIMIT ${limit}`
        return NextResponse.json({ users })
      }
    } catch (e: any) { return serverError(e, 'users', req) }
  }
  try{
    const {searchParams}=new URL(req.url)
    const username=searchParams.get('username'),me=searchParams.get('me')
    if(me){
      const user=await getUser(req)
      if(!user)return NextResponse.json({error:'Unauthenticated'},{status:401})
      // Bump last_seen_at (fire-and-forget) so Active-now pill works everywhere
      db`UPDATE users SET last_seen_at = NOW() WHERE id = ${user.id}`.catch(()=>{})
      const rows=await db`SELECT id,username,display_name,avatar_url,bio,location,is_admin,interests,visited_countries,wishlist_countries,travel_status,verification_status,bb_rating,bb_rating_count,auto_meetup_opt_in,created_at,(SELECT COUNT(*) FROM follows WHERE follower_id=users.id) as following_count,(SELECT COUNT(*) FROM follows WHERE following_id=users.id) as follower_count,(SELECT COUNT(*) FROM checkins WHERE user_id=users.id) as checkin_count,(SELECT COUNT(*) FROM reviews WHERE user_id=users.id) as review_count FROM users WHERE id=${user.id} LIMIT 1`
      return NextResponse.json({user:rows[0]})
    }
    if(!username)return NextResponse.json({error:'username or me required'},{status:400})
    const rows=await db`SELECT id,username,display_name,avatar_url,bio,location,created_at,(SELECT COUNT(*) FROM follows WHERE follower_id=users.id) as following_count,(SELECT COUNT(*) FROM follows WHERE following_id=users.id) as follower_count,(SELECT COUNT(*) FROM checkins WHERE user_id=users.id) as checkin_count,(SELECT COUNT(*) FROM reviews WHERE user_id=users.id) as review_count FROM users WHERE username=${username} AND is_banned=false LIMIT 1`
    if(!rows[0])return NextResponse.json({error:'User not found'},{status:404})
    return NextResponse.json({user:rows[0]})
  }catch(e){return serverError(e, 'users', req)}
}
export async function PATCH(req: NextRequest) {
  try{
    const user=await getUser(req)
    if(!user)return NextResponse.json({error:'Unauthenticated'},{status:401})
    if(user.is_banned)return NextResponse.json({error:'Account suspended'},{status:403})
    const raw=await req.json()
    const display_name=stripExternalLinks(raw.display_name)
    const bio=stripExternalLinks(raw.bio)
    const location=stripExternalLinks(raw.location)
    const avatar_url=raw.avatar_url
    const username=raw.username
    if(username){const taken=await db`SELECT id FROM users WHERE username=${username} AND id!=${user.id} LIMIT 1`;if(taken[0])return NextResponse.json({error:'Username taken'},{status:409})}
    const rows=await db`UPDATE users SET display_name=COALESCE(${display_name??null},display_name),bio=COALESCE(${bio??null},bio),location=COALESCE(${location??null},location),avatar_url=COALESCE(${avatar_url??null},avatar_url),username=COALESCE(${username??null},username),updated_at=NOW() WHERE id=${user.id} RETURNING id,username,display_name,avatar_url,bio,location`
    return NextResponse.json({user:rows[0]})
  }catch(e){return serverError(e, 'users', req)}
}
