'use client'
import { useState, useRef } from 'react'
const C={bg:'#f3f4f6',card:'#fff',border:'#e5e7eb',text:'#111827',sub:'#6b7280',teal:'var(--brand)'}
type Comment={id:string;body:string;created_at:string;display_name:string;avatar_url:string;username:string}
export function CommentSection({entryId,reviewId,count}:{entryId?:string;reviewId?:string;count:number}) {
  const [open,setOpen]=useState(false)
  const [comments,setComments]=useState<Comment[]>([])
  const [loaded,setLoaded]=useState(false)
  const [body,setBody]=useState('')
  const [posting,setPosting]=useState(false)
  const [total,setTotal]=useState(count)
  const inputRef=useRef<HTMLInputElement>(null)
  const load=async()=>{
    const param=entryId?`entry_id=${entryId}`:`review_id=${reviewId}`
    const r=await fetch(`/api/comments?${param}`)
    if(r.ok){const d=await r.json();setComments(d.comments||[]);setLoaded(true)}
  }
  const toggle=()=>{
    if(!open&&!loaded)load()
    setOpen(o=>!o)
    if(!open)setTimeout(()=>inputRef.current?.focus(),100)
  }
  const post=async()=>{
    if(!body.trim()||posting)return
    setPosting(true)
    const payload=entryId?{entry_id:entryId,body}:{review_id:reviewId,body}
    const r=await fetch('/api/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    if(r.ok){const d=await r.json();setComments(c=>[...c,d.comment]);setTotal(t=>t+1);setBody('')}
    setPosting(false)
  }
  const fmt=(iso:string)=>new Date(iso).toLocaleDateString('en-AU',{day:'numeric',month:'short'})
  return (
    <div>
      <button onClick={toggle} style={{background:'none',border:'none',color:open?C.teal:C.sub,cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:13,padding:'6px 12px',borderRadius:8,fontWeight:600}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        {total>0?`${total} `:''}Comment{total!==1?'s':''}
      </button>
      {open&&(
        <div style={{padding:'0 16px 12px',borderTop:`1px solid ${C.border}`,marginTop:4}}>
          {!loaded&&<div style={{color:C.sub,fontSize:13,padding:'8px 0'}}>Loading...</div>}
          {loaded&&comments.length===0&&<div style={{color:C.sub,fontSize:13,padding:'8px 0'}}>No comments yet. Be first!</div>}
          {comments.map(c=>(
            <div key={c.id} style={{display:'flex',gap:10,padding:'10px 0',borderBottom:`1px solid ${C.border}`}}>
              <div style={{width:32,height:32,borderRadius:'50%',background:C.teal,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:13,flexShrink:0,overflow:'hidden'}}>
                {c.avatar_url?<img loading="lazy" decoding="async" src={c.avatar_url} style={{width:32,height:32,objectFit:'cover'}} alt=""/>:(c.display_name||'?')[0].toUpperCase()}
              </div>
              <div style={{flex:1}}>
                <span style={{fontWeight:600,fontSize:13,color:C.text}}>{c.display_name}</span>
                <span style={{fontSize:12,color:C.sub,marginLeft:8}}>{fmt(c.created_at)}</span>
                <div style={{fontSize:14,color:C.text,marginTop:2}}>{c.body}</div>
              </div>
            </div>
          ))}
          <div style={{display:'flex',gap:8,marginTop:10}}>
            <input ref={inputRef} value={body} onChange={e=>setBody(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();post()}}}
              placeholder="Write a comment..." style={{flex:1,border:`1px solid ${C.border}`,borderRadius:99,padding:'8px 14px',fontSize:14,outline:'none',color:C.text,background:C.bg}}/>
            <button onClick={post} disabled={!body.trim()||posting} style={{background:body.trim()?C.teal:'#e5e7eb',color:body.trim()?'#fff':C.sub,border:'none',borderRadius:99,padding:'8px 16px',fontWeight:600,fontSize:13,cursor:body.trim()?'pointer':'default'}}>
              {posting?'...':'Post'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
