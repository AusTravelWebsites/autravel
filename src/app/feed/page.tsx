'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import Link from 'next/link'
import { CommentSection } from '@/components/features/CommentSection';
import { PlaceAutocomplete } from '@/components/features/PlaceAutocomplete';
import { InviteFriendButton } from '@/components/features/InviteFriendButton';

const C = { bg:'#f3f4f6',card:'#fff',border:'#e5e7eb',text:'#111827',sub:'#6b7280',teal:'var(--brand)',tealLight:'var(--brand-light)',orange:'#f97316',red:'#ef4444' };

function AutoMeetupNudge({ user }: { user: any }) {
  const [dismissed, setDismissed] = useState(false);
  const [hasRecentCheckin, setHasRecentCheckin] = useState<boolean | null>(null);
  useEffect(() => {
    try { if (localStorage.getItem('bb-nudge-automeetup-dismissed') === '1') { setDismissed(true); return; } } catch {}
    if (!user || user.auto_meetup_opt_in === false) return;
    fetch('/api/auto-meetups/nearby').then(r => r.ok ? r.json() : null).then(d => {
      setHasRecentCheckin(!d?.reason); // reason set when no recent check-in
    }).catch(() => {});
  }, [user]);
  if (!user || dismissed || hasRecentCheckin !== false || user.auto_meetup_opt_in === false) return null;
  return (
    <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:12, padding:'14px 18px', marginBottom:12, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' as const }}>
      <span style={{ fontSize:24 }}>🌏</span>
      <div style={{ flex:1, minWidth:200 }}>
        <div style={{ fontWeight:700, color:'#92400e', fontSize:14 }}>Check in to find travellers near you</div>
        <div style={{ fontSize:12, color:'#92400e' }}>Share a GPS-verified check-in and we'll let you know when 5+ travellers are within 10 miles.</div>
      </div>
      <Link href="/check-in" style={{ background:'#d97706', color:'#fff', borderRadius:8, padding:'7px 14px', fontSize:13, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' as const }}>Check in</Link>
      <button onClick={() => { try { localStorage.setItem('bb-nudge-automeetup-dismissed','1') } catch {}; setDismissed(true) }} aria-label="Dismiss" style={{ background:'none', border:'none', color:'#92400e', cursor:'pointer', fontSize:20, lineHeight:1, padding:4 }}>×</button>
    </div>
  );
}

function ProfileNudge() {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { try { if (typeof window !== 'undefined' && localStorage.getItem('bb-nudge-onboard-dismissed') === '1') setDismissed(true) } catch {} }, []);
  if (dismissed) return null;
  return (
    <div style={{ background:'var(--brand-light)', border:'1px solid #99f6e4', borderRadius:12, padding:'14px 18px', marginBottom:12, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' as const }}>
      <span style={{ fontSize:24 }}>👋</span>
      <div style={{ flex:1, minWidth:200 }}>
        <div style={{ fontWeight:700, color:'var(--brand-dark)', fontSize:14 }}>Finish setting up your profile</div>
        <div style={{ fontSize:12, color:'var(--brand)' }}>Add a bio + your travel interests so other travellers can find you.</div>
      </div>
      <Link href="/onboarding" style={{ background:'var(--brand)', color:'#fff', borderRadius:8, padding:'7px 14px', fontSize:13, fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' as const }}>Continue</Link>
      <button onClick={() => { try { localStorage.setItem('bb-nudge-onboard-dismissed','1') } catch {}; setDismissed(true) }} aria-label="Dismiss" style={{ background:'none', border:'none', color:'var(--brand-dark)', cursor:'pointer', fontSize:20, lineHeight:1, padding:4 }}>×</button>
    </div>
  );
}

function Avatar({ user, size=40 }: { user:any; size?:number }) {
  const l = (user?.display_name||user?.username||'?')[0].toUpperCase();
  return <div style={{width:size,height:size,borderRadius:'50%',background:C.teal,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:size*0.38,flexShrink:0,overflow:'hidden'}}>{user?.avatar_url?<img loading="lazy" decoding="async" src={user.avatar_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:l}</div>;
}

function timeAgo(ts:string){if(!ts)return'';const s=Math.floor((Date.now()-new Date(ts).getTime())/1000);if(isNaN(s)||s<0)return'';if(s<60)return'just now';if(s<3600)return`${Math.floor(s/60)}m ago`;if(s<86400)return`${Math.floor(s/3600)}h ago`;return`${Math.floor(s/86400)}d ago`;}

function ShareMenu({entry}:{entry:any}){
  const [open,setOpen]=useState(false);
  const url=typeof window!=='undefined'?`${window.location.origin}/places/${entry.place_slug||''}`:'https://bugbitten.com';
  const t=encodeURIComponent((entry.body||'').slice(0,100)+'... via BugBitten');
  const e=encodeURIComponent(url);
  const P=[{n:'Facebook',i:'📘',h:`https://www.facebook.com/sharer/sharer.php?u=${e}`},{n:'Twitter/X',i:'🐦',h:`https://twitter.com/intent/tweet?text=${t}&url=${e}`},{n:'WhatsApp',i:'💬',h:`https://wa.me/?text=${t}%20${e}`},{n:'Reddit',i:'🟧',h:`https://reddit.com/submit?url=${e}&title=${t}`},{n:'Copy Link',i:'🔗',h:'#copy'}];
  const handle=(p:any,ev:React.MouseEvent)=>{if(p.h==='#copy'){ev.preventDefault();navigator.clipboard?.writeText(url);setOpen(false);return;}window.open(p.h,'_blank','noopener,width=600,height=500');setOpen(false);};
  return <div style={{position:'relative'}}><button onClick={()=>setOpen(o=>!o)} style={{background:'none',border:'none',color:C.sub,cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontSize:13,padding:'6px 10px',borderRadius:8,fontFamily:'inherit',fontWeight:600}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Share</button>{open&&<div style={{position:'absolute',bottom:'100%',right:0,marginBottom:6,background:C.card,borderRadius:10,minWidth:170,boxShadow:'0 4px 16px rgba(0,0,0,0.12)',zIndex:20,overflow:'hidden'}}>{P.map(p=><a key={p.n} href={p.h} onClick={ev=>handle(p,ev)} target={p.h.startsWith('http')?'_blank':undefined} rel="noopener noreferrer" style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',color:C.text,textDecoration:'none',fontSize:13,borderBottom:'1px solid #f0f0f0'}}><span style={{fontSize:16}}>{p.i}</span>{p.n}</a>)}</div>}</div>;
}

function PostCard({entry,me}:{entry:any;me:any}){
  // Feed API returns camelCase nested user/place objects
  const u = entry.user || {};
  const p = entry.place || null;
  const username = u.username;
  const displayName = u.displayName || u.display_name || username;
  const avatarUser = { display_name: displayName, username, avatar_url: u.avatarUrl || u.avatar_url };
  const createdAt = entry.createdAt || entry.created_at;
  const likeCount = entry.likeCount ?? entry.like_count ?? 0;
  const commentCount = entry.commentCount ?? entry.comment_count ?? 0;
  const photos = entry.photoUrls || entry.media_urls || [];
  const placeName = p?.name;
  const placeSlug = p?.slug;
  const loc = placeName || entry.location_name || null;
  const slug = placeSlug;
  const img = photos[0] || null;
  const isJournalLike = entry.type === 'journal' || !entry.type;
  const [liked,setLiked]=useState(false);
  const [likes,setLikes]=useState(likeCount);
  const toggleLike=async()=>{
    if (!isJournalLike) return;
    setLiked(l=>!l);setLikes((n:number)=>liked?n-1:n+1);
    await fetch(`/api/journal-entries/${entry.id}/like`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).catch(()=>{});
  };
  return <div style={{background:C.card,borderRadius:12,marginBottom:8,overflow:'hidden',}}>
    <div style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:10}}>
      <Link href={`/${username}`}><Avatar user={avatarUser} size={44}/></Link>
      <div style={{flex:1}}>
        <Link href={`/${username}`} style={{color:C.text,fontWeight:700,fontSize:15,textDecoration:'none'}}>{displayName}</Link>
        <div style={{color:C.sub,fontSize:12,marginTop:2,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
          {loc&&<>{slug?<Link href={`/places/${slug}`} style={{color:C.teal,textDecoration:'none'}}>{loc}</Link>:<Link href={`/explore?q=${encodeURIComponent(loc)}`} style={{color:C.teal,textDecoration:'none'}}>{loc}</Link>}<span>·</span></>}
          <span>{timeAgo(createdAt)}</span>
        </div>
      </div>
      <span style={{background:C.tealLight,color:C.teal,padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700}}>{entry.type==='review'?'Review':entry.type==='checkin'?'Check-in':'Journal'}</span>
    </div>
    <div style={{padding:'0 16px 14px'}}>{(() => { const fs=(entry.body||'').split(/[.!?\n]/)[0]?.trim()||''; const heading=fs.length>6?(fs.length>80?fs.slice(0,77)+'…':fs):(loc?`Journal from ${loc}`:'Journal entry'); return isJournalLike ? <Link href={`/journal-entries/${entry.id}`} style={{textDecoration:'none'}}><h3 style={{fontFamily:'Georgia, serif',fontSize:17,fontWeight:700,color:C.text,margin:'0 0 6px',lineHeight:1.35}}>{heading}</h3></Link> : null; })()}<p style={{color:C.text,fontSize:15,lineHeight:1.65,margin:0}}>{entry.body}</p></div>
    {img&&<div style={{width:'100%',maxHeight:400,overflow:'hidden',background:'#f3f4f6'}}><img loading="lazy" decoding="async" src={img} alt={loc||''} style={{width:'100%',objectFit:'cover',display:'block'}} onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/></div>}
    {loc&&slug&&<div style={{padding:'4px 16px 8px'}}><Link href={`/places/${slug}`} style={{display:'inline-flex',alignItems:'center',background:'var(--brand-light)',color:'var(--brand)',border:'1px solid #99f6e4',borderRadius:'99px',padding:'2px 10px',fontSize:'12px',fontWeight:600,textDecoration:'none'}}>{loc}</Link></div>}
    <div style={{borderTop:'1px solid #f0f0f0',marginTop:12,padding:'8px 12px',display:'flex',alignItems:'center',gap:4}}>
      <button onClick={toggleLike} style={{background:liked?'#fff7ed':'none',border:liked?`1px solid ${C.orange}`:'none',color:liked?C.orange:C.sub,cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:13,padding:'6px 12px',borderRadius:8,fontFamily:'inherit',fontWeight:600}}>{liked?'♥':'♡'} {likes>0?likes:''} Like</button>
      {isJournalLike && <CommentSection entryId={entry.id} count={commentCount} />}
      <div style={{marginLeft:'auto'}}><ShareMenu entry={{...entry, place_slug: slug}}/></div>
    </div>
  </div>;
}

function CreatePost({user,onPost}:{user:any;onPost:()=>void}){
  const [open,setOpen]=useState(false);
  const [mode,setMode]=useState<'journal'|'checkin'|'trip'|'review'>('journal');
  const [body,setBody]=useState('');
  const [location,setLocation]=useState('');
  const [tripDest,setTripDest]=useState('');
  const [tripDate,setTripDate]=useState('');
  const [visibility,setVisibility]=useState<'public'|'followers'|'friends_join'>('followers');
  const [tagInput,setTagInput]=useState('');
  const [tags,setTags]=useState<string[]>([]);
  const [posting,setPosting]=useState(false);
  const [error,setError]=useState('');
  const [photos,setPhotos]=useState<string[]>([]);
  const [uploading,setUploading]=useState(false);
  const MAX_PHOTOS=10;
  const modes=[{id:'journal',icon:'',label:'Journal'},{id:'checkin',icon:'',label:'Check In'},{id:'trip',icon:'',label:'Plan an Adventure'},{id:'review',icon:'',label:'Review'}];
  const addTag=(e:React.KeyboardEvent)=>{if(e.key==='Enter'&&tagInput.trim()){e.preventDefault();const tag=tagInput.trim().replace('@','');if(!tags.includes(tag))setTags(t=>[...t,tag]);setTagInput('');}};
  const onFiles=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const files=Array.from(e.target.files||[]);
    e.target.value='';
    if(!files.length)return;
    const slots=MAX_PHOTOS-photos.length;
    if(slots<=0){setError(`Maximum ${MAX_PHOTOS} photos`);return;}
    setUploading(true);setError('');
    const accepted=files.slice(0,slots);
    try{
      for(const f of accepted){
        if(!f.type.startsWith('image/')){setError(`${f.name} is not an image`);continue;}
        const fd=new FormData();fd.append('file',f);fd.append('folder','journal');
        const r=await fetch('/api/upload',{method:'POST',body:fd});
        const d=await r.json().catch(()=>({}));
        if(!r.ok||!d.url){setError(d.error||`Upload failed: ${f.name}`);continue;}
        setPhotos(prev=>[...prev,d.url]);
      }
    }finally{setUploading(false);}
  };
  const removePhoto=(url:string)=>setPhotos(prev=>prev.filter(u=>u!==url));
  const submit=async()=>{
    if(!body.trim()&&mode!=='checkin'){setError('Please write something');return;}
    if(mode==='checkin'&&!location.trim()){setError('Please enter a location');return;}
    setPosting(true);setError('');
    try{const r=await fetch('/api/journal-entries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({body:body.trim()||`Checked in at ${location}`,location_name:location||tripDest||undefined,media_urls:photos,is_public:visibility!=='followers',visibility,tagged_users:tags,post_type:mode,...(mode==='trip'?{trip_destination:tripDest,trip_date:tripDate}:{})})});if(r.ok){setBody('');setLocation('');setTripDest('');setTripDate('');setTags([]);setPhotos([]);setOpen(false);onPost();}else{const d=await r.json();setError(d.error||'Failed to post');}}catch{setError('Network error');}finally{setPosting(false);}
  };
  return <div style={{background:C.card,borderRadius:12,marginBottom:8,overflow:'hidden',}}>
    <div style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:10}}>
      <Avatar user={user} size={42}/>
      <button onClick={()=>setOpen(o=>!o)} style={{flex:1,background:C.bg,borderRadius:24,padding:'11px 18px',color:C.sub,fontSize:14,textAlign:'left',cursor:'pointer',fontFamily:'inherit'}}>What adventure are you on, {user?.display_name||user?.username}?</button>
    </div>
    <div style={{display:'flex',gap:4,padding:'0 12px 14px',borderBottom:open?`1px solid ${C.border}`:'none'}}>
      {modes.map(m=><button key={m.id} onClick={()=>{const next=m.id as any;if(next==='checkin'){window.location.href='/check-in';return;}if(next==='trip'){window.location.href='/trips/new';return;}if(next==='review'){window.location.href='/reviews/new';return;}setMode(next);setOpen(true);if(next!=='trip'&&visibility==='friends_join')setVisibility('followers');}} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,background:open&&mode===m.id?C.tealLight:C.bg,border:`1px solid ${open&&mode===m.id?C.teal:'transparent'}`,borderRadius:8,padding:'8px 4px',color:open&&mode===m.id?C.teal:C.sub,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}><span>{m.icon}</span><span>{m.label}</span></button>)}
    </div>
    {open&&<div style={{padding:'14px 16px'}}>
      <textarea value={body} onChange={e=>setBody(e.target.value)} rows={4} placeholder={mode==='checkin'?"What's happening here?":mode==='trip'?'Tell people about your trip plans...':mode==='review'?'Write your review...':'Share your adventure...'} style={{width:'100%',background:C.bg,borderRadius:10,padding:'12px 14px',color:C.text,fontSize:15,outline:'none',resize:'vertical',fontFamily:'inherit',lineHeight:1.6,boxSizing:'border-box'}}/>
      {mode!=='trip'&&<div style={{marginTop:10}}><PlaceAutocomplete value={location} onChange={setLocation} placeholder="Add location (Google Places)..." inputStyle={{width:'100%',background:C.bg,borderRadius:10,padding:'10px 14px',border:'none',color:C.text,fontSize:14,outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const}}/></div>}
      {mode==='trip'&&<div style={{marginTop:10,display:'flex',gap:10}}><div style={{flex:1,display:'flex',alignItems:'center',gap:8,background:C.bg,borderRadius:10,padding:'10px 14px'}}><span></span><input value={tripDest} onChange={e=>setTripDest(e.target.value)} placeholder="Destination..." style={{flex:1,background:'transparent',border:'none',color:C.text,fontSize:14,outline:'none',fontFamily:'inherit'}}/></div><div style={{flex:1,display:'flex',alignItems:'center',gap:8,background:C.bg,borderRadius:10,padding:'10px 14px'}}><span></span><input type="date" value={tripDate} onChange={e=>setTripDate(e.target.value)} style={{flex:1,background:'transparent',border:'none',color:C.text,fontSize:14,outline:'none',fontFamily:'inherit'}}/></div></div>}
      <div style={{marginTop:10,display:'flex',alignItems:'center',flexWrap:'wrap',gap:6,background:C.bg,borderRadius:10,padding:'8px 14px'}}><span></span>{tags.map(t=><span key={t} style={{background:C.tealLight,color:C.teal,padding:'3px 10px',borderRadius:20,fontSize:13,display:'flex',alignItems:'center',gap:5}}>@{t}<button onClick={()=>setTags(ts=>ts.filter(x=>x!==t))} style={{background:'none',border:'none',color:C.teal,cursor:'pointer',padding:0,fontSize:14,lineHeight:1}}></button></span>)}<input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={addTag} placeholder="Tag a friend @username (Enter)" style={{flex:1,minWidth:160,background:'transparent',border:'none',color:C.text,fontSize:13,outline:'none',fontFamily:'inherit'}}/></div>
      {/* Photo upload */}
      <div style={{marginTop:10}}>
        <div style={{display:'flex',flexWrap:'wrap' as const,gap:8}}>
          {photos.map(url=>(
            <div key={url} style={{position:'relative' as const,width:84,height:84,borderRadius:8,overflow:'hidden',background:C.bg,border:`1px solid ${C.border}`}}>
              <img loading="lazy" decoding="async" src={url} alt="" style={{width:'100%',height:'100%',objectFit:'cover' as const}}/>
              <button type="button" onClick={()=>removePhoto(url)} aria-label="Remove" style={{position:'absolute' as const,top:4,right:4,width:20,height:20,borderRadius:'50%',background:'rgba(0,0,0,0.7)',color:'#fff',border:'none',cursor:'pointer',fontSize:12,lineHeight:'18px',padding:0}}>×</button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label style={{width:84,height:84,borderRadius:8,border:`2px dashed ${C.border}`,display:'flex',flexDirection:'column' as const,alignItems:'center',justifyContent:'center' as const,gap:4,cursor: uploading?'wait':'pointer',color:C.sub,fontSize:11,fontWeight:600,fontFamily:'inherit'}}>
              <span style={{fontSize:20,lineHeight:1}}>{uploading?'…':'+'}</span>
              <span>{uploading?'Uploading':'Photo'}</span>
              <input type="file" accept="image/*" multiple disabled={uploading} onChange={onFiles} style={{display:'none'}}/>
            </label>
          )}
        </div>
        <div style={{color:C.sub,fontSize:11,marginTop:6}}>Up to {MAX_PHOTOS} photos · resized to 1280px WebP, stored on Cloudflare R2 · {photos.length}/{MAX_PHOTOS} added</div>
      </div>
      <div style={{marginTop:12}}><div style={{color:C.sub,fontSize:12,marginBottom:6,fontWeight:600}}>Who can see this?</div><div style={{display:'flex',gap:8}}>{[{id:'public',icon:'',label:'Public',desc:'Anyone'},{id:'followers',icon:'',label:'Followers',desc:'Followers only'},...(mode==='trip'?[{id:'friends_join',icon:'',label:'Open to Join',desc:'Others can join'}]:[])].map(v=><button key={v.id} onClick={()=>setVisibility(v.id as any)} style={{flex:1,background:visibility===v.id?C.tealLight:C.bg,border:`1px solid ${visibility===v.id?C.teal:'transparent'}`,borderRadius:10,padding:'10px 8px',cursor:'pointer',fontFamily:'inherit',textAlign:'center'}}><div style={{fontSize:18,marginBottom:3}}>{v.icon}</div><div style={{color:visibility===v.id?C.teal:C.text,fontSize:12,fontWeight:700}}>{v.label}</div><div style={{color:C.sub,fontSize:11,marginTop:2}}>{v.desc}</div></button>)}</div></div>
      {error&&<div style={{color:C.red,fontSize:13,marginTop:10}}> {error}</div>}
      <div style={{marginTop:14,display:'flex',justifyContent:'flex-end',gap:10}}><button onClick={()=>setOpen(false)} style={{background:C.bg,borderRadius:8,padding:'9px 20px',color:C.sub,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button><button onClick={submit} disabled={posting} style={{background:C.teal,border:'none',borderRadius:8,padding:'9px 24px',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit',opacity:posting?0.7:1}}>{posting?'Posting...':mode==='checkin'?' Check In':mode==='trip'?' Share Trip':mode==='review'?' Post Review':' Post'}</button></div>
    </div>}
  </div>;
}

function LeftSidebar({user}:{user:any}){
  const links=[{href:'/feed',icon:'',label:'Feed'},{href:'/explore',icon:'',label:'Explore Places'},{href:'/check-in',icon:'',label:'Check In'},{href:'/friends',icon:'',label:'Friends'},{href:'/favourites',icon:'',label:'Favourites'},{href:'/meetups',icon:'',label:'Meetups'},{href:'/trips',icon:'',label:'My Trips'},{href:user?`/${user.username}/locations`:'/login',icon:'',label:'Your Locations'},{href:'/messages',icon:'',label:'Messages'},{href:'/my-reviews',icon:'',label:'My Reviews'}];
  return <div style={{position:'sticky',top:76}}>
    <div style={{background:C.card,borderRadius:12,overflow:'hidden',}}>
      {user&&<Link href={`/${user.username}`} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',textDecoration:'none',borderBottom:'1px solid #f0f0f0',background:C.tealLight}}><Avatar user={user} size={40}/><div><div style={{color:C.text,fontWeight:700,fontSize:14}}>{user.display_name||user.username}</div><div style={{color:C.teal,fontSize:12}}>View my profile </div></div></Link>}
      {links.map((l,i)=><Link key={l.href+i} href={l.href} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',color:C.text,textDecoration:'none',borderBottom:i<links.length-1?`1px solid ${C.border}`:'none',fontSize:14,fontWeight:(l as any).bold?700:500}}><span style={{fontSize:18}}>{l.icon}</span>{l.label}</Link>)}
    </div>
  </div>;
}


function InviteWidget({username,displayName}:{username?:string;displayName?:string}){
  const [copied,setCopied]=useState(false);
  const refParam = username ? `?ref=${encodeURIComponent(username)}` : '';
  const inviteUrl = `https://bugbitten.com/signup${refParam}`;
  const inviteText = displayName
    ? `${displayName} invited you to join BugBitten — GPS-verified travel journal + traveller meetups. `
    : `Join me on BugBitten — GPS-verified travel journal + traveller meetups. `;
  const fbShare = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteUrl)}&quote=${encodeURIComponent(inviteText)}`;
  const mailto = `mailto:?subject=${encodeURIComponent('Join me on BugBitten')}&body=${encodeURIComponent(inviteText + '\n\n' + inviteUrl)}`;
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };
  const pillBtnStyle = (bg: string, color: string): React.CSSProperties => ({
    flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
    background:bg, color, borderRadius:8, padding:'9px 8px', fontSize:12, fontWeight:700,
    textDecoration:'none', border:'none', cursor:'pointer', fontFamily:'inherit', minWidth:0,
  });
  return (
    <div style={{background:C.card,borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
      <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,color:C.text,fontWeight:700,fontSize:14}}>Invite Friends</div>
      <div style={{padding:'14px 16px 10px'}}>
        <div style={{fontSize:12,color:C.sub,marginBottom:10,lineHeight:1.45}}>Share BugBitten with friends — they'll see your adventures when they join.</div>
        <div style={{display:'flex',gap:6,marginBottom:8}}>
          <a href={fbShare} target="_blank" rel="noopener noreferrer" style={pillBtnStyle('#1877f2','#fff')} aria-label="Share on Facebook">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.9 3.78-3.9 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12z"/></svg>
            Facebook
          </a>
          <button onClick={copyLink} style={pillBtnStyle('linear-gradient(45deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)','#fff')} aria-label="Copy link to share on Instagram">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            Instagram
          </button>
          <a href={mailto} style={pillBtnStyle(C.bg,C.text)} aria-label="Invite via email">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg>
            Email
          </a>
        </div>
        {copied && <div style={{fontSize:11,color:C.teal,fontWeight:600,textAlign:'center',marginBottom:6}}>Link copied — paste it into your Instagram story or DM</div>}
        <button onClick={copyLink} style={{display:'block',width:'100%',background:'transparent',border:'none',color:C.sub,fontSize:11,textAlign:'center',cursor:'pointer',padding:'4px 0',fontFamily:'inherit'}}>
          or copy invite link
        </button>
      </div>
      <div style={{padding:'10px 16px 14px',borderTop:`1px solid ${C.border}`,background:'#fafbfc'}}>
        <div style={{fontSize:11,color:C.sub,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Follow BugBitten</div>
        <div style={{display:'flex',gap:6}}>
          <a href="https://www.facebook.com/BugBitten.comTravel" target="_blank" rel="noopener noreferrer"
             style={{flex:1,display:'flex',alignItems:'center',gap:8,background:'#fff',border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 10px',textDecoration:'none',color:C.text,fontSize:12,fontWeight:600}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877f2" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.9 3.78-3.9 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12z"/></svg>
            Facebook
          </a>
          <a href="https://www.instagram.com/bugbitten.travel/" target="_blank" rel="noopener noreferrer"
             style={{flex:1,display:'flex',alignItems:'center',gap:8,background:'#fff',border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 10px',textDecoration:'none',color:C.text,fontSize:12,fontWeight:600}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e6683c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            Instagram
          </a>
        </div>
      </div>
    </div>
  );
}

function RightSidebar({user}:{user:any}){
  const [people,setPeople]=useState<any[]>([]);
  const [online,setOnline]=useState<any[]>([]);
  useEffect(()=>{
    fetch('/api/users?limit=5&exclude_following=1').then(r=>r.ok?r.json():null).then(d=>{if(d?.users)setPeople(d.users);}).catch(()=>{});
    fetch('/api/presence').then(r=>r.ok?r.json():null).then(d=>{if(d?.online)setOnline(d.online);}).catch(()=>{});
  },[]);
  return <div style={{display:'flex',flexDirection:'column',gap:16}}>
    {user&&<Link href="/auto-meetups" style={{ display: 'block', textDecoration: 'none' }}>
      <div style={{ background: 'linear-gradient(135deg, var(--brand-light) 0%, #fffbeb 100%)', border: '1px solid #99f6e4', borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--brand-dark)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>🌏 Auto-meetups</div>
        <div style={{ fontSize: 13, color: 'var(--brand-dark)', fontWeight: 600, marginBottom: 2 }}>See travellers near you</div>
        <div style={{ fontSize: 11, color: 'var(--brand)' }}>Within 10 miles, from your last check-in →</div>
      </div>
    </Link>}
    {online.length>0&&<div style={{background:C.card,borderRadius:12,overflow:'hidden',}}>
      <div style={{padding:'12px 16px',borderBottom:'1px solid #f0f0f0',display:'flex',alignItems:'center',gap:8,color:C.text,fontWeight:700,fontSize:14}}><span style={{width:8,height:8,borderRadius:'50%',background:'#22c55e',display:'inline-block'}}/>Friends Online</div>
      {[...online].sort((a:any,b:any)=>{ if(a.city&&b.city&&a.city===b.city)return -1; if(a.country&&b.country&&a.country===b.country)return 0; return 1; }).map((f:any)=><div key={f.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderBottom:'1px solid #f0f0f0'}}><div style={{position:'relative'}}><Avatar user={f} size={34}/><span style={{position:'absolute',bottom:0,right:0,width:10,height:10,borderRadius:'50%',background:'#22c55e',border:'2px solid #fff'}}/></div><div style={{flex:1}}><Link href={`/${f.username}`} style={{color:C.text,fontWeight:600,fontSize:13,textDecoration:'none',display:'block'}}>{f.display_name||f.username}</Link><span style={{color:C.sub,fontSize:11}}> {f.city||f.country||'Online'}</span></div><Link href={`/messages?with=${f.id}`} style={{color:C.teal,fontSize:16,textDecoration:'none'}}></Link></div>)}
    </div>}
    {/* Invite Friends + Follow us */}
    <InviteWidget username={user?.username} displayName={user?.display_name}/>

    {/* Popular Destinations */}
    <div style={{background:C.card,borderRadius:12,border:`1px solid ${C.border}`,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
      <div style={{padding:'12px 16px',borderBottom:`1px solid ${C.border}`,color:C.text,fontWeight:700,fontSize:14}}> Popular Destinations</div>
      {[
        {name:'Angkor Wat, Cambodia',emoji:'🛕',slug:'angkor-wat'},
        {name:'Hoi An Ancient Town, Vietnam',emoji:'🏮',slug:'hoi-an-ancient-town'},
        {name:'Ha Long Bay, Vietnam',emoji:'🏝️',slug:'ha-long-bay'},
        {name:'Borobudur Temple, Indonesia',emoji:'🛕',slug:'borobudur-temple'},
        {name:'Kuta Beach, Bali',emoji:'🏖️',slug:'kuta-beach'},
        {name:'Luang Prabang, Laos',emoji:'⛰️',slug:'luang-prabang'},
      ].map(p=><Link key={p.slug} href={`/places/${p.slug}`} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',color:C.text,textDecoration:'none',borderBottom:`1px solid ${C.border}`,fontSize:13}}><span style={{fontSize:18}}>{p.emoji}</span><span>{p.name}</span></Link>)}
    </div>

    {people.length>0&&<div style={{background:C.card,borderRadius:12,overflow:'hidden',}}>
      <div style={{padding:'12px 16px',borderBottom:'1px solid #f0f0f0',color:C.text,fontWeight:700,fontSize:14}}> Suggested Travellers</div>
      {people.map((p:any)=><div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderBottom:'1px solid #f0f0f0'}}><Avatar user={p} size={34}/><div style={{flex:1}}><Link href={`/${p.username}`} style={{color:C.text,fontWeight:600,fontSize:13,textDecoration:'none',display:'block'}}>{p.display_name||p.username}</Link><span style={{color:C.sub,fontSize:11}}>{p.location||'Traveller'}</span></div><Link href={`/${p.username}`} style={{color:C.teal,fontSize:12,fontWeight:700,textDecoration:'none',background:C.tealLight,padding:'4px 10px',borderRadius:20}}>Follow</Link></div>)}
    </div>}
    <div style={{background:C.card,borderRadius:12,padding:14,}}>
      <div style={{color:C.sub,fontSize:11,marginBottom:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>Share BugBitten</div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{[{l:'📘 Facebook',h:'https://www.facebook.com/sharer/sharer.php?u=https://bugbitten.com'},{l:'🐦 Twitter',h:'https://twitter.com/intent/tweet?text=GPS-verified+travel&url=https://bugbitten.com'},{l:'💬 WhatsApp',h:'https://wa.me/?text=BugBitten+https://bugbitten.com'}].map(s=><a key={s.l} href={s.h} target="_blank" rel="noopener noreferrer" style={{flex:1,minWidth:80,background:C.bg,color:C.text,borderRadius:8,padding:'8px 6px',textAlign:'center',textDecoration:'none',fontSize:12,fontWeight:600}}>{s.l}</a>)}</div>
    </div>
  </div>;
}

export default function FeedPage(){
  const [entries,setEntries]=useState<any[]>([]);
  const [user,setUser]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [feedMode,setFeedMode]=useState<'following'|'mine'|'global'>('following');
  const loadFeed=(mode:'following'|'mine'|'global'=feedMode)=>{
    setLoading(true);
    fetch('/api/feed?mode='+mode).then(r=>r.ok?r.json():null).then(d=>{setEntries(d?.entries||[]);setLoading(false);}).catch(()=>setLoading(false));
  };
  useEffect(()=>{fetch('/api/users?me=1').then(r=>r.ok?r.json():null).then(d=>{if(d?.user)setUser(d.user);}).catch(()=>{});},[]);
  useEffect(()=>{loadFeed(feedMode);},[feedMode]);
  return <div style={{background:C.bg,minHeight:'100vh',paddingBottom:40}}>
    <style>{`
      @media (max-width: 1024px) {
        .bb-feed-grid { grid-template-columns: 1fr !important; }
        .bb-feed-grid > :first-child, .bb-feed-grid > :last-child { display: none !important; }
      }
    `}</style>
    <div className="bb-feed-grid" style={{maxWidth:1200,margin:'0 auto',padding:'24px 16px',display:'grid',gridTemplateColumns:'260px 1fr 280px',gap:20,alignItems:'start'}}>
      <LeftSidebar user={user}/>
      <div>
        {user && (
          !user.bio || (user.bio || '').trim().length < 10
          || !user.location
          || !Array.isArray(user.interests) || user.interests.length < 3
        ) && (
          <ProfileNudge />
        )}
        <AutoMeetupNudge user={user} />
        {user&&<CreatePost user={user} onPost={()=>loadFeed()}/>}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap' as const,gap:10}}>
          <div style={{display:'flex',gap:6,background:'#fff',border:`1px solid ${C.border}`,borderRadius:999,padding:3}}>
            {([
              {id:'following',label:'Friends'},
              {id:'mine',label:'My Feed'},
              {id:'global',label:'Everyone'},
            ] as const).map(t=>(
              <button key={t.id} onClick={()=>setFeedMode(t.id)}
                style={{border:'none',borderRadius:999,padding:'7px 14px',fontSize:13,fontWeight:700,cursor:'pointer',background:feedMode===t.id?C.teal:'transparent',color:feedMode===t.id?'#fff':C.sub,fontFamily:'inherit'}}>
                {t.label}
              </button>
            ))}
          </div>
          <span style={{color:C.sub,fontSize:13}}>{entries.length} adventures</span>
        </div>
        {loading?<div style={{color:C.sub,textAlign:'center',padding:40}}>Loading adventures...</div>:entries.length===0?<div style={{background:C.card,borderRadius:12,padding:40,textAlign:'center'}}>
          <div style={{fontSize:48,marginBottom:12}}></div>
          <div style={{color:C.text,fontWeight:700,fontSize:18,marginBottom:8}}>
            {feedMode==='mine'?'You haven\u2019t posted yet':feedMode==='following'?'No posts from friends yet':'No adventures yet'}
          </div>
          <div style={{color:C.sub,fontSize:14,marginBottom:16}}>
            {feedMode==='mine'?'Share a journal, check-in or review to start your feed.':feedMode==='following'?'Follow travellers to see their adventures here.':'Check back soon.'}
          </div>
          <Link href={feedMode==='mine'?'/feed':feedMode==='following'?'/friends':'/explore'} style={{background:C.teal,color:'#fff',borderRadius:8,padding:'10px 24px',textDecoration:'none',fontWeight:700}}>
            {feedMode==='mine'?'Write a post':feedMode==='following'?'Find friends':'Explore Places'}
          </Link>
        </div>:entries.map((e:any)=><PostCard key={e.id} entry={e} me={user}/>)}
      </div>
      <RightSidebar user={user}/>
    </div>
  </div>;
}
