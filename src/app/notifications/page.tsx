'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { initializeApp, getApps } from 'firebase/app'
const FC = { apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, storageBucket:process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, messagingSenderId:process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID }
if (!getApps().length) initializeApp(FC)
export default function NotificationsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [notifs, setNotifs] = useState<any[]>([])
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    const auth = getAuth()
    return onAuthStateChanged(auth, (u) => {
      if (!u) { router.push('/login'); return }
      setLoading(false)
      fetch('/api/notifications?limit=50').then(r=>r.json()).then(d => {
        if (d.notifications) { setNotifs(d.notifications); setUnread(d.unread_count||0) }
      })
    })
  }, [router])
  async function markAllRead() {
    await fetch('/api/notifications', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({all:true}) })
    setNotifs(prev => prev.map(n => ({...n,read:true}))); setUnread(0)
  }
  const icons: Record<string,string> = {
    follow:'👤',like:'❤️',comment:'💬',review:'⭐',checkin:'📍',
    tag_review:'🏷️',tag_trip:'🧳',tag:'🏷️',
    meetup_invite:'🤝',meetup_join_request:'📨',meetup_approved:'✅',meetup_comment:'💬',meetup_rated:'⭐',
    blog_comment:'💬',
    auto_meetup:'🌏',
  }
  const verbs: Record<string,string> = {
    follow: 'started following you',
    like: 'liked your post',
    comment: 'commented on your post',
    tag_review: 'tagged you in a review',
    tag_trip: 'tagged you in a trip',
    tag: 'tagged you',
    review: 'left a review',
    checkin: 'checked in',
    meetup_invite: 'invited you to a meetup',
    meetup_join_request: 'wants to join your meetup',
    meetup_approved: 'sent a meetup update',
    meetup_comment: 'commented on your meetup',
    meetup_rated: 'rated your meetup',
    blog_comment: 'commented on your blog post',
    auto_meetup: 'travellers are near you — say hi!',
  }
  if (loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#ffffff'}}><div style={{width:40,height:40,border:'3px solid #333',borderTopColor:'#0d9488',borderRadius:'50%',animation:'spin 0.8s linear infinite'}} /></div>
  return (
    <div style={{minHeight:'100vh',background:'#f3f4f6',color:'#111827',fontFamily:'system-ui'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{borderBottom:'1px solid #e5e7eb',position:'sticky',top:0,background:'#ffffff',zIndex:10}}>
        <div style={{maxWidth:600,margin:'0 auto',padding:'16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <a href="/feed" style={{color:'#555',textDecoration:'none',fontSize:20}}>←</a>
            <span style={{fontFamily:'Georgia',fontSize:20,fontWeight:700,color:'#111827'}}>Notifications</span>
            {unread>0 && <span style={{background:'#0d9488',color:'#f3f4f6',borderRadius:20,padding:'2px 8px',fontSize:12,fontWeight:700}}>{unread}</span>}
          </div>
          {unread>0 && <button onClick={markAllRead} style={{background:'none',border:'1px solid #e5e7eb',color:'#374151',padding:'6px 14px',borderRadius:20,fontSize:12,cursor:'pointer'}}>Mark all read</button>}
        </div>
      </div>
      <div style={{maxWidth:600,margin:'0 auto',padding:16}}>
        {notifs.length===0 && <div style={{textAlign:'center',color:'#6b7280',padding:'60px 0'}}><div style={{fontSize:48,marginBottom:12}}>🔔</div><div>No notifications yet</div></div>}
        {notifs.map((n:any) => {
          const row = (
            <>
              <div style={{fontSize:20,flexShrink:0,marginTop:2}}>{icons[n.type]||'🔔'}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,color:'#374151',lineHeight:1.5}}>
                  {n.actor_username && <span style={{color:'#0d9488',fontWeight:600}}>{n.actor_name||n.actor_username}</span>}
                  {' '}{verbs[n.type] || n.message || n.type}
                </div>
                {n.preview && <div style={{fontSize:12,color:'#6b7280',marginTop:2,lineHeight:1.4}}>{n.preview}</div>}
                <div style={{fontSize:11,color:'#6b7280',marginTop:4}}>{new Date(n.created_at).toLocaleDateString()}</div>
              </div>
              {!n.read && <div style={{width:8,height:8,borderRadius:'50%',background:'#0d9488',flexShrink:0,marginTop:4}} />}
            </>
          )
          const styles: React.CSSProperties = {background:n.read?'#ffffff':'#f0fdfa',border:`1px solid ${n.read?'#e5e7eb':'#f9fafb'}`,borderRadius:10,padding:'14px 16px',marginBottom:8,display:'flex',alignItems:'flex-start',gap:12,textDecoration:'none',color:'inherit'}
          return n.link
            ? <a key={n.id} href={n.link} style={styles}>{row}</a>
            : <div key={n.id} style={styles}>{row}</div>
        })}
      </div>
    </div>
  )
}