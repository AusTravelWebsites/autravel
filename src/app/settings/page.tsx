'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlaceAutocomplete } from '@/components/features/PlaceAutocomplete';

const C = { bg:'#f3f4f6',card:'#fff',border:'#e5e7eb',text:'#111827',sub:'#6b7280',teal:'#0d9488',tealLight:'#f0fdfa',red:'#ef4444',orange:'#f97316' };

function Section({ title, icon, children }: { title:string; icon:string; children:React.ReactNode }) {
  return (
    <div style={{ background:C.card, borderRadius:12, border:`1px solid ${C.border}`, overflow:'hidden', marginBottom:16, boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:10 }}>
        {icon && <span style={{ fontSize:20 }}>{icon}</span>}
        <h2 style={{ color:C.text, fontWeight:700, fontSize:16, margin:0 }}>{title}</h2>
      </div>
      <div style={{ padding:'8px 0' }}>{children}</div>
    </div>
  );
}

function SettingRow({ label, desc, children, danger }: { label:string; desc?:string; children?:React.ReactNode; danger?:boolean }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:`1px solid ${C.bg}`, gap:16 }}>
      <div style={{ flex:1 }}>
        <div style={{ color: danger ? C.red : C.text, fontWeight:600, fontSize:14 }}>{label}</div>
        {desc && <div style={{ color:C.sub, fontSize:12, marginTop:3 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange }: { on:boolean; onChange:(v:boolean)=>void }) {
  return (
    <div onClick={() => onChange(!on)} style={{ width:44, height:24, borderRadius:12, background: on ? C.teal : '#d1d5db', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
      <div style={{ position:'absolute', top:2, left: on ? 22 : 2, width:20, height:20, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
    </div>
  );
}

function Select({ value, onChange, options }: { value:string; onChange:(v:string)=>void; options:{value:string;label:string}[] }) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 12px', color:C.text, fontSize:13, outline:'none', cursor:'pointer' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [activeSection, setActiveSection] = useState('profile');

  // Profile fields
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');

  // Preferences
  const [theme, setTheme] = useState('light');
  const [language, setLanguage] = useState('en');
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [followNotifs, setFollowNotifs] = useState(true);
  const [likeNotifs, setLikeNotifs] = useState(true);
  const [messageNotifs, setMessageNotifs] = useState(true);
  const [meetupNotifs, setMeetupNotifs] = useState(true);
  const [blogNotifs, setBlogNotifs] = useState(true);
  const [autoMeetupOptIn, setAutoMeetupOptIn] = useState(true);
  const [autoMeetupEmail, setAutoMeetupEmail] = useState(true);
  const [profilePublic, setProfilePublic] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [showOnline, setShowOnline] = useState(true);
  const [feedDefault, setFeedDefault] = useState('followers');

  useEffect(() => {
    fetch('/api/users?me=1').then(r=>r.ok?r.json():null).then(d=>{
      if (d?.user) {
        setUser(d.user);
        setDisplayName(d.user.display_name || '');
        setBio(d.user.bio || '');
        setLocation(d.user.location || '');
        setWebsite(d.user.website || '');
        if (typeof d.user.auto_meetup_opt_in === 'boolean') setAutoMeetupOptIn(d.user.auto_meetup_opt_in);
      }
    }).catch(()=>{});
    fetch('/api/me/email-prefs').then(r=>r.ok?r.json():null).then(d=>{
      const p = d?.prefs || {};
      if (typeof p.like === 'boolean') setLikeNotifs(p.like);
      if (typeof p.follow === 'boolean') setFollowNotifs(p.follow);
      if (typeof p.new_message === 'boolean') setMessageNotifs(p.new_message);
      const meetupKeys = ['meetup_invite','meetup_join_request','meetup_approved','meetup_comment','meetup_rated'];
      setMeetupNotifs(meetupKeys.every(k => p[k] !== false));
      if (typeof p.blog_comment === 'boolean') setBlogNotifs(p.blog_comment);
      if (typeof p.auto_meetup === 'boolean') setAutoMeetupEmail(p.auto_meetup);
      // emailNotifs is a master switch — true if any of the type-specific ones are true
      const anyOn = ['like','comment','follow','tag_trip','tag_review','new_message','meetup_invite','meetup_join_request','meetup_approved','meetup_comment','meetup_rated','blog_comment'].some(k => p[k] !== false);
      setEmailNotifs(anyOn);
    }).catch(()=>{});
    const saved = localStorage.getItem('bb_theme') || 'light';
    setTheme(saved);
  }, []);

  const saveEmailPref = async (key: 'like'|'comment'|'follow'|'tag_trip'|'tag_review'|'new_message'|'meetup_invite'|'meetup_join_request'|'meetup_approved'|'meetup_comment'|'meetup_rated'|'blog_comment'|'auto_meetup', value: boolean) => {
    try {
      await fetch('/api/me/email-prefs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: value }) });
    } catch {}
  };

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const saveProfile = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/users/me', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ display_name: displayName, bio, location, website }) });
      if (r.ok) { setSaved('profile'); setTimeout(()=>setSaved(''), 3000); }
    } finally { setSaving(false); }
  };

  const uploadAvatar = async (file: File) => {
    setAvatarError(''); setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'avatars');
      const ur = await fetch('/api/upload', { method: 'POST', body: fd });
      const ud = await ur.json();
      if (!ur.ok || !ud.url) throw new Error(ud.error || 'Upload failed');
      const r = await fetch('/api/users/me', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ avatar_url: ud.url }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Save failed');
      setUser((u: any) => ({ ...(u || {}), avatar_url: ud.url }));
      setSaved('profile'); setTimeout(()=>setSaved(''), 3000);
    } catch (e: any) {
      setAvatarError(e.message || 'Upload failed');
    } finally { setUploadingAvatar(false); }
  };

  const handleTheme = (val: string) => {
    setTheme(val);
    localStorage.setItem('bb_theme', val);
    document.documentElement.setAttribute('data-theme', val);
    // Apply immediately
    if (val === 'dark') {
      document.body.style.background = '#0b1420';
      document.body.style.color = '#e8f0fe';
    } else {
      document.body.style.background = '#f3f4f6';
      document.body.style.color = '#111827';
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/session', { method:'DELETE' });
    router.push('/login');
  };

  const navItems = [
    { id:'profile', icon:'', label:'Profile' },
    { id:'account', icon:'', label:'Account & Security' },
    { id:'notifications', icon:'', label:'Notifications' },
    { id:'privacy', icon:'', label:'Privacy' },
    { id:'appearance', icon:'', label:'Appearance' },
    { id:'feed', icon:'', label:'Feed Preferences' },
    { id:'data', icon:'', label:'Your Data' },
    { id:'help', icon:'', label:'Help & Support' },
  ];

  const inp = (val:string, set:(v:string)=>void, ph:string, multi=false) => multi
    ? <textarea value={val} onChange={e=>set(e.target.value)} placeholder={ph} rows={3} style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', color:C.text, fontSize:14, outline:'none', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' as const }}/>
    : <input value={val} onChange={e=>set(e.target.value)} placeholder={ph} style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', color:C.text, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' as const }}/>;

  return (
    <div style={{ background:C.bg, minHeight:'100vh', paddingBottom:40 }}>
      <style>{`
        @media (max-width: 900px) {
          .bb-settings-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div className="bb-settings-grid" style={{ maxWidth:1100, margin:'0 auto', padding:'24px 16px', display:'grid', gridTemplateColumns:'240px 1fr', gap:20, alignItems:'start' }}>

        {/* Left nav */}
        <div style={{ position:'sticky', top:76 }}>
          <div style={{ background:C.card, borderRadius:12, border:`1px solid ${C.border}`, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', marginBottom:12 }}>
            {user && (
              <Link href={`/${user.username}`} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', textDecoration:'none', borderBottom:`1px solid ${C.border}`, background:C.tealLight }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:C.teal, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:16, overflow:'hidden', flexShrink:0 }}>
                  {user.avatar_url ? <img loading="lazy" decoding="async" src={user.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : (user.display_name||user.username||'?')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ color:C.text, fontWeight:700, fontSize:14 }}>{user.display_name || user.username}</div>
                  <div style={{ color:C.teal, fontSize:12 }}>View my profile →</div>
                </div>
              </Link>
            )}
            {navItems.map(n => (
              <button key={n.id} onClick={()=>setActiveSection(n.id)}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', width:'100%', background: activeSection===n.id ? C.tealLight : 'transparent', border:'none', borderBottom:`1px solid ${C.bg}`, borderLeft: activeSection===n.id ? `3px solid ${C.teal}` : '3px solid transparent', color: activeSection===n.id ? C.teal : C.text, fontSize:14, fontWeight: activeSection===n.id ? 700 : 500, cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}>
                {n.icon && <span style={{ fontSize:18 }}>{n.icon}</span>}{n.label}
              </button>
            ))}
          </div>
          <button onClick={handleLogout} style={{ width:'100%', background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'12px 16px', color:C.red, fontSize:14, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, fontFamily:'inherit' }}>
            Log out
          </button>
        </div>

        {/* Main content */}
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
            <Link href="/feed" style={{ color:C.sub, textDecoration:'none', fontSize:13 }}>← Back to Feed</Link>
            <span style={{ color:C.border }}>·</span>
            <h1 style={{ fontFamily:'Georgia, serif', color:C.text, fontWeight:800, fontSize:24, margin:0 }}>Settings</h1>
          </div>

          {/* PROFILE */}
          {activeSection === 'profile' && (
            <Section title="Profile Information" icon="">
              <div style={{ padding:'16px 20px' }}>
                <div style={{ marginBottom:20, display:'flex', alignItems:'center', gap:16 }}>
                  <div style={{ width:72, height:72, borderRadius:'50%', background:C.teal, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:28, overflow:'hidden', flexShrink:0 }}>
                    {user?.avatar_url ? <img loading="lazy" decoding="async" src={user.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : (user?.display_name || user?.username || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex:1 }}>
                    <label style={{ color:C.sub, fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:6 }}>Profile Photo</label>
                    <label style={{ display:'inline-block', background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 14px', fontSize:13, fontWeight:600, color:C.text, cursor: uploadingAvatar ? 'wait' : 'pointer' }}>
                      {uploadingAvatar ? 'Uploading...' : 'Change photo'}
                      <input type="file" accept="image/*" disabled={uploadingAvatar} onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ''; }} style={{ display:'none' }}/>
                    </label>
                    {avatarError && <div style={{ color:C.red, fontSize:12, marginTop:6 }}>{avatarError}</div>}
                  </div>
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ color:C.sub, fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:6 }}>Display Name</label>
                  {inp(displayName, setDisplayName, 'Your name')}
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ color:C.sub, fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:6 }}>Bio</label>
                  {inp(bio, setBio, 'Tell travellers about yourself...', true)}
                  <div style={{ color:C.sub, fontSize:11, marginTop:4 }}>{bio.length}/200 characters</div>
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ color:C.sub, fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:6 }}>Location</label>
                  <PlaceAutocomplete
                    value={location}
                    onChange={setLocation}
                    placeholder="Where are you based?"
                    inputStyle={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'10px 12px', color:C.text, fontSize:14, outline:'none', fontFamily:'inherit', boxSizing:'border-box' as const }}
                  />
                </div>
                {saved === 'profile' && <div style={{ color:C.teal, fontSize:13, marginBottom:12, background:C.tealLight, padding:'8px 12px', borderRadius:8 }}> Profile saved!</div>}
                <button onClick={saveProfile} disabled={saving} style={{ background:C.teal, border:'none', borderRadius:8, padding:'10px 24px', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit', opacity:saving?0.7:1 }}>
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </Section>
          )}

          {/* ACCOUNT */}
          {activeSection === 'account' && (
            <Section title="Account & Security" icon="">
              <SettingRow label="Email Address" desc={user?.email || 'Not set'}>
                <button style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 14px', color:C.text, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Change</button>
              </SettingRow>
              <SettingRow label="Password" desc="Last changed: unknown">
                <button style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 14px', color:C.text, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Update</button>
              </SettingRow>
              <SettingRow label="Two-Factor Authentication" desc="Add an extra layer of security">
                <button style={{ background:C.teal, border:'none', borderRadius:8, padding:'6px 14px', color:'#fff', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>Enable</button>
              </SettingRow>
              <SettingRow label="Active Sessions" desc="See where you're logged in">
                <button style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 14px', color:C.text, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>View</button>
              </SettingRow>
              <SettingRow label="Connected Accounts" desc="Google, Facebook login">
                <button style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 14px', color:C.text, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Manage</button>
              </SettingRow>
              <SettingRow label="Delete Account" desc="Permanently delete your account and all data" danger>
                <Link href="/user-data" style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, padding:'6px 14px', color:C.red, fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600, textDecoration:'none' }}>Delete</Link>
              </SettingRow>
            </Section>
          )}

          {/* NOTIFICATIONS */}
          {activeSection === 'notifications' && (
            <Section title="Notifications" icon="">
              <SettingRow label="Email — All" desc="Master switch: turn off to stop every email"><Toggle on={emailNotifs} onChange={v => { setEmailNotifs(v); ['like','comment','follow','tag_trip','tag_review','new_message','meetup_invite','meetup_join_request','meetup_approved','meetup_comment','meetup_rated','blog_comment'].forEach(k => saveEmailPref(k as any, v)); setLikeNotifs(v); setFollowNotifs(v); setMessageNotifs(v); setMeetupNotifs(v); setBlogNotifs(v); }}/></SettingRow>
              <SettingRow label="Push Notifications" desc="Browser push notifications (coming soon)"><Toggle on={pushNotifs} onChange={setPushNotifs}/></SettingRow>
              <SettingRow label="Email — New Followers" desc="When someone follows you"><Toggle on={followNotifs} onChange={v => { setFollowNotifs(v); saveEmailPref('follow', v); }}/></SettingRow>
              <SettingRow label="Email — Likes & Comments" desc="When someone likes or comments"><Toggle on={likeNotifs} onChange={v => { setLikeNotifs(v); saveEmailPref('like', v); saveEmailPref('comment', v); }}/></SettingRow>
              <SettingRow label="Email — Direct Messages" desc="When you receive a message"><Toggle on={messageNotifs} onChange={v => { setMessageNotifs(v); saveEmailPref('new_message', v); }}/></SettingRow>
              <SettingRow label="Email — Meetups" desc="Invites, join requests, approvals, comments & ratings"><Toggle on={meetupNotifs} onChange={v => { setMeetupNotifs(v); ['meetup_invite','meetup_join_request','meetup_approved','meetup_comment','meetup_rated'].forEach(k => saveEmailPref(k as any, v)); }}/></SettingRow>
              <SettingRow label="Email — Blog Comments" desc="When someone comments on your blog post"><Toggle on={blogNotifs} onChange={v => { setBlogNotifs(v); saveEmailPref('blog_comment', v); }}/></SettingRow>
              <SettingRow label="Auto-meetup alerts" desc="Notify me when 5+ travellers are within 10 miles">
                <Toggle on={autoMeetupOptIn} onChange={async v => {
                  setAutoMeetupOptIn(v);
                  await fetch('/api/users/me', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ auto_meetup_opt_in: v }) });
                }}/>
              </SettingRow>
              <SettingRow label="Email — Auto-meetup alerts" desc="Send the auto-meetup alert by email too">
                <Toggle on={autoMeetupEmail} onChange={v => { setAutoMeetupEmail(v); saveEmailPref('auto_meetup', v); }}/>
              </SettingRow>
              <SettingRow label="Trip Join Requests" desc="When someone requests to join your trip"><Toggle on={true} onChange={()=>{}}/></SettingRow>
              <SettingRow label="Nearby Travellers" desc="Alert when friends are in the same country"><Toggle on={true} onChange={()=>{}}/></SettingRow>
            </Section>
          )}

          {/* PRIVACY */}
          {activeSection === 'privacy' && (
            <Section title="Privacy & Visibility" icon="">
              <SettingRow label="Public Profile" desc="Anyone can view your profile"><Toggle on={profilePublic} onChange={setProfilePublic}/></SettingRow>
              <SettingRow label="Show Location" desc="Display your current location on profile"><Toggle on={showLocation} onChange={setShowLocation}/></SettingRow>
              <SettingRow label="Show Online Status" desc="Let friends see when you're online"><Toggle on={showOnline} onChange={setShowOnline}/></SettingRow>
              <SettingRow label="Allow Message Requests" desc="Receive messages from non-followers"><Toggle on={true} onChange={()=>{}}/></SettingRow>
              <SettingRow label="GPS Verification" desc="Required for verified reviews  always on">
                <span style={{ color:C.teal, fontSize:13, fontWeight:700 }}>Always on </span>
              </SettingRow>
              <BlockedList />
            </Section>
          )}

          {/* APPEARANCE */}
          {activeSection === 'appearance' && (
            <Section title="Appearance" icon="">
              <SettingRow label="Theme" desc="Choose your preferred colour theme">
                <div style={{ display:'flex', gap:8 }}>
                  {[
                    { val:'light', icon:'', label:'Light' },
                    { val:'dark',  icon:'', label:'Dark' },
                    { val:'auto',  icon:'', label:'Auto' },
                  ].map(t => (
                    <button key={t.val} onClick={() => handleTheme(t.val)}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:`2px solid ${theme===t.val ? C.teal : C.border}`, background: theme===t.val ? C.tealLight : C.bg, color: theme===t.val ? C.teal : C.text, fontSize:13, fontWeight: theme===t.val ? 700 : 500, cursor:'pointer', fontFamily:'inherit' }}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </SettingRow>
              <SettingRow label="Language" desc="Interface language">
                <Select value={language} onChange={setLanguage} options={[
                  { value:'en', label:'English' },
                  { value:'es', label:'Espaol' },
                  { value:'fr', label:'Franais' },
                  { value:'de', label:'Deutsch' },
                  { value:'zh', label:'' },
                  { value:'ja', label:'' },
                ]}/>
              </SettingRow>
              <SettingRow label="Compact Feed" desc="Show more posts with less spacing"><Toggle on={false} onChange={()=>{}}/></SettingRow>
              <SettingRow label="Autoplay Videos" desc="Automatically play videos in feed"><Toggle on={true} onChange={()=>{}}/></SettingRow>
            </Section>
          )}

          {/* FEED */}
          {activeSection === 'feed' && (
            <Section title="Feed Preferences" icon="">
              <SettingRow label="Default Feed" desc="What posts to show first">
                <Select value={feedDefault} onChange={setFeedDefault} options={[
                  { value:'followers', label:'Following' },
                  { value:'public',    label:'Everyone' },
                  { value:'nearby',    label:'Nearby Travellers' },
                ]}/>
              </SettingRow>
              <SettingRow label="Show Check-ins" desc="Display check-in posts in feed"><Toggle on={true} onChange={()=>{}}/></SettingRow>
              <SettingRow label="Show Reviews" desc="Display review posts in feed"><Toggle on={true} onChange={()=>{}}/></SettingRow>
              <SettingRow label="Show Trip Plans" desc="Display trip plan posts in feed"><Toggle on={true} onChange={()=>{}}/></SettingRow>
              <SettingRow label="Show Suggested Travellers" desc="Discover new people to follow"><Toggle on={true} onChange={()=>{}}/></SettingRow>
              <SettingRow label="GPS Verified Only" desc="Only show posts from verified visits"><Toggle on={false} onChange={()=>{}}/></SettingRow>
            </Section>
          )}

          {/* DATA */}
          {activeSection === 'data' && (
            <Section title="Your Data" icon="">
              <SettingRow label="Download Your Data" desc="Get a copy of everything BugBitten has about you">
                <button style={{ background:C.teal, border:'none', borderRadius:8, padding:'6px 14px', color:'#fff', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>Request Download</button>
              </SettingRow>
              <SettingRow label="Reviews & Check-ins" desc="All your GPS-verified activity">
                <Link href="/craig" style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 14px', color:C.text, fontSize:13, textDecoration:'none' }}>View All</Link>
              </SettingRow>
              <SettingRow label="Location History" desc="Manage stored location data">
                <button style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, padding:'6px 14px', color:C.red, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Clear</button>
              </SettingRow>
              <SettingRow label="Connected Apps" desc="Third-party apps with access">
                <button style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 14px', color:C.text, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Manage</button>
              </SettingRow>
            </Section>
          )}

          {/* HELP */}
          {activeSection === 'help' && (
            <Section title="Help & Support" icon="">
              <SettingRow label="Help Centre" desc="Find answers to common questions">
                <a href="https://bugbitten.com/about" style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 14px', color:C.text, fontSize:13, textDecoration:'none' }}>Visit</a>
              </SettingRow>
              <SettingRow label="Report a Problem" desc="Something not working? Let us know">
                <button style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 14px', color:C.text, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Report</button>
              </SettingRow>
              <SettingRow label="Privacy Policy" desc="How we handle your data">
                <Link href="/privacy" style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 14px', color:C.text, fontSize:13, textDecoration:'none' }}>Read</Link>
              </SettingRow>
              <SettingRow label="Terms of Service" desc="Our terms and conditions">
                <Link href="/terms" style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 14px', color:C.text, fontSize:13, textDecoration:'none' }}>Read</Link>
              </SettingRow>
              <SettingRow label="About BugBitten" desc="Version info and credits">
                <span style={{ color:C.sub, fontSize:13 }}>v1.0 Beta</span>
              </SettingRow>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function BlockedList() {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/blocks').then(r => r.ok ? r.json() : { blocks: [] }).then(d => { setBlocks(d?.blocks || []); setLoading(false); });
  }, []);
  const unblock = async (userId: string) => {
    await fetch(`/api/blocks?user_id=${userId}`, { method: 'DELETE' });
    setBlocks(b => b.filter(x => x.id !== userId));
  };
  return (
    <div style={{ padding: '14px 20px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 6 }}>Blocked users</div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>Blocked users can't see your content and you can't see theirs.</div>
      {loading ? <div style={{ fontSize: 13, color: C.sub }}>Loading…</div>
        : blocks.length === 0 ? <div style={{ fontSize: 13, color: C.sub }}>You haven't blocked anyone.</div>
        : <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {blocks.map((b: any) => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, background: C.bg, borderRadius: 8 }}>
                {b.avatar_url
                  ? <img loading="lazy" decoding="async" src={b.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' as const }} />
                  : <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.teal, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' as const, fontWeight: 700 }}>{(b.display_name || b.username || '?')[0].toUpperCase()}</div>}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{b.display_name || b.username}</div>
                  <div style={{ fontSize: 11, color: C.sub }}>@{b.username}</div>
                </div>
                <button onClick={() => unblock(b.id)} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600, color: C.teal, cursor: 'pointer', fontFamily: 'inherit' }}>Unblock</button>
              </div>
            ))}
          </div>}
    </div>
  );
}
