"use strict";exports.id=624,exports.ids=[624],exports.modules={30624:(a,b,c)=>{c.r(b),c.d(b,{ArticleView:()=>F,default:()=>E,generateMetadata:()=>B,revalidate:()=>z});var d=c(75338),e=c(65169),f=c.n(e),g=c(82161),h=c(35552),i=c(84362);let j={cruis:["%cruise%","%sail%","%yacht%","%boat%"],sail:["%sail%","%yacht%","%cruise%"],yacht:["%yacht%","%sail%","%charter%"],charter:["%charter%","%yacht%"],reef:["%reef%","%snorkel%","%dive%","%cruise%"],div:["%dive%","%snorkel%","%reef%"],scuba:["%dive%","%scuba%","%snorkel%"],snorkel:["%snorkel%","%reef%","%dive%"],whale:["%whale%","%cruise%"],fish:["%fish%","%charter%"],kayak:["%kayak%","%paddle%"],rafting:["%raft%"],surf:["%surf%"],hike:["%hike%","%hiking%","%trek%","%walk%"],tour:["%tour%"]};async function k(a,b){if(!b.length)return[];try{return await (0,h.db)`
      SELECT slug, title, price_from, currency, cover_image, booking_url, rating, review_count, duration_label
      FROM tours
      WHERE state_code = ${a}
        AND active = true
        AND booking_url IS NOT NULL
        AND (LOWER(title) LIKE ANY(${b}::text[]))
      ORDER BY (COALESCE(review_count, 0) * COALESCE(rating::numeric, 0)) DESC NULLS LAST
      LIMIT 3
    `}catch{return[]}}async function l({article:a}){let b=function(a){let b=[a.title,...a.tags||[],...a.categories||[]].join(" ").toLowerCase(),c=Object.keys(j).filter(a=>b.includes(a));if(!c.length)return[];let d=new Set;return c.forEach(a=>j[a].forEach(a=>d.add(a))),[...d]}(a);if(!b.length)return null;let c=await k(a.state_code,b);return c.length?(0,d.jsxs)("section",{style:{marginTop:32,padding:"20px 22px",background:"var(--brand-light)",border:"1px solid #a7f3d0",borderRadius:12},children:[(0,d.jsx)("div",{style:{fontSize:12,color:"var(--brand-dark)",fontWeight:800,textTransform:"uppercase",letterSpacing:1,marginBottom:12},children:"Book a real cruise or tour"}),(0,d.jsx)("div",{style:{display:"grid",gap:14},children:c.map(a=>(0,d.jsxs)("a",{href:a.booking_url,rel:"sponsored nofollow noopener",target:"_blank",style:{display:"flex",gap:14,padding:14,background:"#fff",border:"1px solid #e5e7eb",borderRadius:10,textDecoration:"none",color:"#111827"},children:[a.cover_image&&(0,d.jsx)("img",{src:a.cover_image,alt:"",loading:"lazy",style:{width:110,height:110,objectFit:"cover",borderRadius:8,flexShrink:0}}),(0,d.jsxs)("div",{style:{minWidth:0,flex:1},children:[(0,d.jsx)("div",{style:{fontWeight:700,fontSize:15,lineHeight:1.3,marginBottom:6},children:a.title}),(0,d.jsxs)("div",{style:{fontSize:13,color:"#6b7280",marginBottom:4},children:[a.duration_label,a.rating?`${a.duration_label?" \xb7 ":""}★${Number(a.rating).toFixed(1)}${a.review_count?` (${a.review_count})`:""}`:""]}),a.price_from&&(0,d.jsxs)("div",{style:{fontSize:14,fontWeight:700,color:"var(--brand)"},children:["From ",a.currency||"AUD"," $",Math.round(Number(a.price_from))," →"]})]})]},a.slug))}),(0,d.jsx)("div",{style:{fontSize:11,color:"#6b7280",marginTop:10,fontStyle:"italic"},children:"Affiliate links via Viator — we may earn a small commission when you book, at no cost to you."})]}):null}let m={booking:{cta:"Check rates & book",brand:"Booking.com"},cruise_com:{cta:"Compare cruise prices",brand:"Cruise.com"},captain_cook:{cta:"Book direct",brand:"Captain Cook Cruises"},direct:{cta:"Book direct",brand:"the operator"}},n=["direct","captain_cook","cruise_com","booking"];function o({links:a,label:b}){if(!a)return null;let c=n.filter(b=>"string"==typeof a[b]&&a[b].startsWith("http")).map(b=>({key:b,url:a[b],...m[b]}));return c.length?(0,d.jsxs)("section",{style:{marginTop:24,padding:"20px 22px",background:"linear-gradient(135deg,var(--brand) 0%,var(--brand-dark) 100%)",borderRadius:12,color:"#fff"},children:[(0,d.jsx)("div",{style:{fontSize:13,fontWeight:800,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12},children:b||"Book this experience"}),(0,d.jsx)("div",{style:{display:"grid",gap:10},children:c.map(a=>(0,d.jsxs)("a",{href:a.url,rel:"sponsored nofollow noopener",target:"_blank",style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:"#fff",color:"var(--brand-dark)",borderRadius:8,textDecoration:"none",fontWeight:700},children:[(0,d.jsxs)("span",{children:[a.cta," ",(0,d.jsxs)("span",{style:{fontWeight:500,color:"#6b7280",fontSize:13},children:["on ",a.brand]})]}),(0,d.jsx)("span",{"aria-hidden":!0,children:"→"})]},a.key))})]}):null}let p={card:"#fff",border:"#e5e7eb",text:"#111827",sub:"#6b7280",teal:"var(--brand)",tealLight:"var(--brand-light)"};async function q({article:a}){let b=function(a){if(!a)return null;let b=a.match(/^\/([^\/]+)\//);return b?b[1].toLowerCase():null}(a.legacy_path)||a.destination_slug,c=function(a){if(!a)return null;let b=a.match(/^(\/[^\/]+\/[^\/]+\/)/);return b?b[1]:null}(a.legacy_path);if(!b&&!c)return null;let e=a.destination_slug||b,[g,i,j,k]=await Promise.all([e?(0,h.db)`
          SELECT slug, name, region, hero_image
            FROM destinations
           WHERE active = true
             AND state_code = ${a.state_code}
             AND slug = ${e}
           LIMIT 1`.catch(()=>[]):Promise.resolve([]),c?(0,h.db)`
          SELECT slug, title, legacy_path, cover_image
            FROM articles
           WHERE state_code = ${a.state_code}
             AND status = 'published'
             AND legacy_path LIKE ${c+"%"}
             AND slug <> ${a.slug}
           ORDER BY published_at DESC NULLS LAST
           LIMIT 6`.catch(()=>[]):Promise.resolve([]),e?(0,h.db)`
          SELECT p.slug, p.name, p.suburb, p.region, p.cover_image, p.avg_rating
            FROM parks p
           WHERE p.active = true AND p.state_code = ${a.state_code}
             AND (p.suburb ILIKE ${"%"+e.replace(/-/g," ")+"%"}
                  OR p.region ILIKE ${"%"+e.replace(/-/g," ")+"%"})
           ORDER BY p.featured DESC, p.avg_rating DESC NULLS LAST
           LIMIT 3`.catch(()=>[]):Promise.resolve([]),e?(0,h.db)`
          SELECT slug, title, city, cover_image, rating, price_from, currency
            FROM tours
           WHERE active = true AND state_code = ${a.state_code}
             AND (city ILIKE ${e.replace(/-/g," ")} OR title ILIKE ${"%"+e.replace(/-/g," ")+"%"})
           ORDER BY featured DESC, rating DESC NULLS LAST, review_count DESC NULLS LAST
           LIMIT 3`.catch(()=>[]):Promise.resolve([])]),l=g[0];if(!l&&0===i.length&&0===j.length&&0===k.length)return null;let m=l?.name||(e?e.replace(/-/g," ").replace(/\b\w/g,a=>a.toUpperCase()):"this destination");return(0,d.jsxs)("section",{style:{marginTop:40,paddingTop:28,borderTop:`2px solid ${p.tealLight}`},children:[(0,d.jsxs)("h2",{style:{fontFamily:"Georgia, serif",fontSize:24,fontWeight:800,color:p.text,margin:"0 0 6px"},children:["More about ",m]}),(0,d.jsx)("p",{style:{fontSize:14,color:p.sub,margin:"0 0 22px"},children:"Other guides, accommodation, tours and travel reads from the same area."}),l&&(0,d.jsxs)(f(),{href:`/${l.slug}/`,style:{display:"flex",gap:16,padding:14,background:p.card,border:`1px solid ${p.border}`,borderRadius:12,marginBottom:22,textDecoration:"none",color:"inherit",alignItems:"center"},children:[l.hero_image&&(0,d.jsx)("img",{src:l.hero_image,alt:l.name,loading:"lazy",style:{width:110,height:80,objectFit:"cover",borderRadius:8,flexShrink:0}}),(0,d.jsxs)("div",{style:{flex:1,minWidth:0},children:[(0,d.jsx)("div",{style:{fontSize:11,color:p.sub,textTransform:"uppercase",letterSpacing:1,fontWeight:700},children:l.region||"Destination guide"}),(0,d.jsxs)("div",{style:{fontSize:18,fontWeight:700,color:p.text,marginTop:2},children:["The full ",l.name," travel guide"]}),(0,d.jsx)("div",{style:{fontSize:13,color:p.teal,fontWeight:600,marginTop:4},children:"Tours, parks, attractions and where to stay →"})]})]}),(0,d.jsxs)("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:22},children:[i.length>0&&(0,d.jsxs)("div",{children:[(0,d.jsx)("h3",{style:r,children:"More guides from this area"}),(0,d.jsx)("ul",{style:s,children:i.map(a=>(0,d.jsx)("li",{style:{borderBottom:`1px solid ${p.border}`,padding:"8px 0"},children:(0,d.jsx)(f(),{href:a.legacy_path||`/articles/${a.slug}/`,style:t,children:a.title})},a.slug))})]}),j.length>0&&(0,d.jsxs)("div",{children:[(0,d.jsxs)("h3",{style:r,children:["Caravan parks in ",m]}),(0,d.jsx)("ul",{style:s,children:j.map(a=>(0,d.jsx)("li",{style:{borderBottom:`1px solid ${p.border}`,padding:"8px 0"},children:(0,d.jsxs)(f(),{href:`/parks/${a.slug}/`,style:t,children:[a.name,a.avg_rating?(0,d.jsxs)("span",{style:{color:p.sub,fontWeight:400,marginLeft:6},children:["★ ",Number(a.avg_rating).toFixed(1)]}):null]})},a.slug))}),(0,d.jsxs)(f(),{href:`/parks/?q=${encodeURIComponent(m)}`,style:u,children:["See all parks in ",m," →"]})]}),k.length>0&&(0,d.jsxs)("div",{children:[(0,d.jsxs)("h3",{style:r,children:["Tours in ",m]}),(0,d.jsx)("ul",{style:s,children:k.map(a=>(0,d.jsx)("li",{style:{borderBottom:`1px solid ${p.border}`,padding:"8px 0"},children:(0,d.jsxs)(f(),{href:`/tours/${a.slug}/`,style:t,children:[a.title,a.price_from&&(0,d.jsxs)("span",{style:{color:p.sub,fontWeight:400,marginLeft:6},children:["from ",a.currency||"AUD"," $",Number(a.price_from).toFixed(0)]})]})},a.slug))}),(0,d.jsxs)(f(),{href:`/tours/?loc=${encodeURIComponent(m)}`,style:u,children:["See all tours in ",m," →"]})]})]})]})}let r={fontFamily:"Georgia, serif",fontSize:15,fontWeight:800,color:p.text,margin:"0 0 4px",paddingBottom:6,borderBottom:`2px solid ${p.teal}`},s={listStyle:"none",padding:0,margin:0},t={color:p.text,textDecoration:"none",fontSize:14,fontWeight:600,display:"block",lineHeight:1.4},u={display:"inline-block",marginTop:8,color:p.teal,fontSize:13,fontWeight:700,textDecoration:"none"};var v=c(42519),w=c(76430),x=c(3175),y=c(99046);let z=600;async function A(a,b){try{let[c]=await (0,h.db)`
      SELECT * FROM articles
      WHERE slug = ${a}
        AND status = 'published'
        AND (${b}::text IS NULL OR state_code = ${b}::text)
      LIMIT 1`;return c||null}catch{return null}}async function B({params:a}){let{slug:b}=await a,c=await (0,i.getTenant)(),d=await A(b,(0,i.stateFilterValue)(c));if(!d)return{title:"Article not found"};let e=d.seo_title||d.title,f=e.length>45?e.slice(0,42).replace(/\s+\S*$/,"")+"…":e,g=d.body_html?String(d.body_html).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().split(/(?<=[.!?])\s/).slice(0,2).join(" "):"",h=d.seo_description||d.excerpt||(g&&g.length>60?g:"")||`${d.title} — travel guide for ${c.stateName} from ${c.name}.`,j=h.length>155?h.slice(0,152).replace(/\s+\S*$/,"")+"…":h,k=`https://${c.host}${d.legacy_path||`/articles/${d.slug}/`}`;return{title:f,description:j,alternates:{canonical:k},robots:d.noindex?{index:!1,follow:!0}:void 0,openGraph:{title:f,description:j,type:"article",url:k,images:d.cover_image?[d.cover_image]:[]},twitter:{card:"summary_large_image",title:f,description:j,images:d.cover_image?[d.cover_image]:[]}}}let C={bg:"#f3f4f6",teal:"var(--brand)"};async function D(a){if(!a.slug&&!a.name)return null;try{return(await (0,h.db)`
      SELECT slug, name, role, bio, avatar_url FROM autravel.authors
       WHERE is_active = true AND (slug = ${a.slug??""} OR name = ${a.name??""})
       LIMIT 1`)[0]||null}catch{return null}}async function E({params:a}){let{slug:b}=await a,c=await (0,i.getTenant)(),e=await A(b,(0,i.stateFilterValue)(c));e||(0,g.notFound)();let f=await D({slug:e.author_slug,name:e.author}),h=await (0,y.H)(c.state_code);return(0,d.jsx)(F,{article:e,tenant:c,author:f,adSlots:h})}function F({article:a,tenant:b,author:c,destinationSubMenu:e,adSlots:g}){let h=`https://${b.host}${a.legacy_path||`/articles/${a.slug}/`}`,i={"@context":"https://schema.org","@type":"Article",headline:a.title,description:a.excerpt||void 0,image:a.cover_image||void 0,datePublished:a.published_at||void 0,author:a.author?{"@type":"Person",name:a.author,url:c?.slug?`https://${b.host}/authors/${c.slug}/`:void 0,jobTitle:c?.role||void 0}:void 0,publisher:{"@type":"Organization",name:b.name,logo:{"@type":"ImageObject",url:`https://${b.host}/favicon.ico`}},mainEntityOfPage:h},j={"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Home",item:`https://${b.host}/`},{"@type":"ListItem",position:2,name:"Articles",item:`https://${b.host}/articles/`},{"@type":"ListItem",position:3,name:a.title,item:h}]},k=a.body_html?(0,x.c0)((0,x.JQ)((0,x.jw)(a.body_html))):[],m=k.length?{"@context":"https://schema.org","@type":"FAQPage",mainEntity:k.map(a=>({"@type":"Question",name:a.question,acceptedAnswer:{"@type":"Answer",text:a.answer}}))}:null,n=(a.categories||[])[0]||"Articles";return(0,d.jsxs)("main",{style:{minHeight:"100vh",background:C.bg},children:[(0,d.jsx)("script",{type:"application/ld+json",dangerouslySetInnerHTML:{__html:JSON.stringify(i)}}),(0,d.jsx)("script",{type:"application/ld+json",dangerouslySetInnerHTML:{__html:JSON.stringify(j)}}),m&&(0,d.jsx)("script",{type:"application/ld+json",dangerouslySetInnerHTML:{__html:JSON.stringify(m).replace(/</g,"\\u003c")}}),(0,d.jsx)("section",{style:{background:"linear-gradient(135deg,var(--brand) 0%,var(--brand-dark) 100%)",padding:"32px 20px 28px",textAlign:"center"},children:(0,d.jsxs)("div",{style:{maxWidth:780,margin:"0 auto"},children:[(0,d.jsx)("div",{style:{display:"flex",justifyContent:"center",marginBottom:10},children:(0,d.jsx)(w.B,{crumbs:[{href:"/",label:"Home"},{href:"/articles/",label:"Travel articles"},{label:a.title.length>60?a.title.slice(0,57).replace(/\s+\S*$/,"")+"…":a.title}]})}),(0,d.jsx)("div",{style:{fontSize:11,color:"rgba(255,255,255,0.75)",letterSpacing:2,textTransform:"uppercase",fontWeight:700,marginBottom:10},children:n}),(0,d.jsx)("h1",{style:{color:"#fff",fontFamily:"Georgia, serif",fontWeight:800,fontSize:"clamp(26px,5vw,40px)",margin:"0 0 10px",lineHeight:1.15},children:a.title}),(a.author||a.published_at)&&(0,d.jsxs)("div",{style:{fontSize:13,color:"rgba(255,255,255,0.9)"},children:[a.author&&(c?(0,d.jsxs)(d.Fragment,{children:["By ",(0,d.jsx)(f(),{href:`/authors/${c.slug}/`,style:{color:"#fff",textDecoration:"underline"},children:c.name})]}):(0,d.jsxs)(d.Fragment,{children:["By ",a.author]})),a.author&&a.published_at?" \xb7 ":"",a.published_at?new Date(a.published_at).toLocaleDateString("en-AU",{year:"numeric",month:"long",day:"numeric"}):""]})]})}),e&&(0,d.jsx)(v.x,{destinationName:e.destinationName,groups:e.groups,currentPath:a.legacy_path||void 0}),(0,d.jsxs)("article",{style:{maxWidth:780,margin:"0 auto",padding:"32px 20px 60px"},children:[a.body_html&&(0,d.jsx)("div",{className:"article-body",dangerouslySetInnerHTML:{__html:(0,x.mi)((0,x.UG)((0,x.D$)((0,x.JQ)((0,x.jw)(a.body_html))),b.host),{in_article_1:(0,y.Z)(g||{},"in_article_1"),in_article_2:(0,y.Z)(g||{},"in_article_2"),content_end:(0,y.Z)(g||{},"content_end")})}}),a.destination_slug&&(0,d.jsxs)("div",{style:{marginTop:28,padding:"16px 18px",background:"var(--brand-light)",border:"1px solid #a7f3d0",borderRadius:12},children:[(0,d.jsx)("div",{style:{fontSize:12,color:"var(--brand-dark)",fontWeight:700,textTransform:"uppercase",letterSpacing:1},children:"Destination"}),(0,d.jsxs)(f(),{href:`/${a.destination_slug}`,style:{color:C.teal,fontWeight:700,textDecoration:"none",fontSize:16},children:["See the full ",a.destination_slug.replace(/-/g," ")," guide →"]})]}),(0,d.jsx)(o,{links:a.affiliate_links}),(0,d.jsx)(l,{article:a}),(0,d.jsx)(q,{article:a}),(c||a.author)&&(0,d.jsx)(G,{author:c,authorName:a.author,tenant:b})]})]})}function G({author:a,authorName:b,tenant:c}){let e=a?.name||b||"",g=a?.role||`${c.name} editorial`,h=a?.bio||`${e} writes for ${c.name}, covering travel across ${c.stateName}.`,i=a?.slug,j=a?.avatar_url,k=e.split(/\s+/).map(a=>a[0]).filter(Boolean).slice(0,2).join("").toUpperCase();return(0,d.jsxs)("aside",{style:{marginTop:32,padding:"20px 22px",background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:12,display:"flex",gap:16,alignItems:"flex-start"},children:[j?(0,d.jsx)("img",{src:j,alt:e,width:56,height:56,style:{width:56,height:56,borderRadius:"50%",objectFit:"cover",flexShrink:0}}):(0,d.jsx)("div",{"aria-hidden":"true",style:{width:56,height:56,borderRadius:"50%",background:"var(--brand)",color:"#fff",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,fontFamily:"Georgia, serif"},children:k}),(0,d.jsxs)("div",{style:{minWidth:0},children:[i?(0,d.jsxs)(f(),{href:`/authors/${i}/`,style:{textDecoration:"none",color:"inherit"},children:[(0,d.jsx)("div",{style:{fontSize:14,fontWeight:800,color:"#111827"},children:e}),(0,d.jsx)("div",{style:{fontSize:12,color:"var(--brand)",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6},children:g})]}):(0,d.jsxs)("div",{children:[(0,d.jsx)("div",{style:{fontSize:14,fontWeight:800,color:"#111827"},children:e}),(0,d.jsx)("div",{style:{fontSize:12,color:"var(--brand)",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6},children:g})]}),(0,d.jsx)("p",{style:{fontSize:14,color:"#374151",margin:0,lineHeight:1.6},children:h}),i&&(0,d.jsxs)(f(),{href:`/authors/${i}/`,style:{display:"inline-block",marginTop:10,fontSize:13,color:"var(--brand)",fontWeight:700,textDecoration:"none"},children:["More from ",e.split(" ")[0]," →"]})]})]})}},42519:(a,b,c)=>{c.d(b,{x:()=>h});var d=c(75338),e=c(65169),f=c.n(e);let g={bg:"#fff",border:"#e5e7eb",borderStrong:"#cbd5e1",text:"#0f172a",sub:"#64748b",accent:"var(--brand)",accentDark:"var(--brand-dark)",accentLight:"var(--brand-light)"};function h({destinationName:a,groups:b,currentPath:c}){let e=b.find(a=>null===a.group)?.items.find(a=>a.isOverview),h=b.filter(a=>a.group&&a.items.length>0);return h.length<2?null:(0,d.jsxs)("nav",{"aria-label":`Explore ${a}`,style:{background:g.bg,borderBottom:`1px solid ${g.border}`,position:"relative",zIndex:50},children:[(0,d.jsx)("style",{children:`
        .mini-nav-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 10px 16px;
          align-items: center;
          max-width: 1240px;
          margin: 0 auto;
        }
        .mini-nav-label {
          flex-shrink: 0;
          font-size: 11px;
          font-weight: 700;
          color: ${g.sub};
          text-transform: uppercase;
          letter-spacing: 1.2px;
          padding: 4px 6px 4px 0;
          white-space: nowrap;
        }
        .mini-nav-chip,
        .mini-nav-cat > summary {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          color: ${g.text};
          background: ${g.bg};
          border: 1px solid ${g.border};
          text-decoration: none;
          white-space: nowrap;
          cursor: pointer;
          list-style: none;
          transition: color .15s, background .15s, border-color .15s;
        }
        .mini-nav-cat > summary::-webkit-details-marker { display: none; }
        .mini-nav-cat > summary::after {
          content: '▾';
          font-size: 9px;
          opacity: 0.55;
          margin-left: 2px;
        }
        .mini-nav-chip:hover,
        .mini-nav-cat > summary:hover {
          color: ${g.accentDark};
          background: ${g.accentLight};
          border-color: ${g.accent};
        }
        .mini-nav-chip[aria-current="page"],
        .mini-nav-cat[open] > summary {
          background: ${g.accent};
          color: #fff;
          border-color: ${g.accent};
        }
        .mini-nav-cat { position: relative; }
        .mini-nav-cat[open] > summary::after { content: '▴'; opacity: 0.9; }
        .mini-nav-cat-count {
          opacity: 0.75;
          font-weight: 500;
          font-size: 11.5px;
        }
        .mini-nav-cat[open] .mini-nav-cat-count { opacity: 0.95; color: rgba(255,255,255,0.9); }
        .mini-nav-cat-panel {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          z-index: 100;
          min-width: 240px;
          max-width: 340px;
          max-height: 70vh;
          overflow-y: auto;
          background: ${g.bg};
          border: 1px solid ${g.borderStrong};
          border-radius: 10px;
          padding: 8px;
          box-shadow: 0 12px 28px -10px rgba(15,23,42,0.18);
        }
        .mini-nav-cat-panel a {
          display: block;
          padding: 6px 10px;
          font-size: 13.5px;
          color: ${g.text};
          text-decoration: none;
          border-radius: 6px;
          line-height: 1.35;
        }
        .mini-nav-cat-panel a:hover { background: ${g.accentLight}; color: ${g.accentDark}; }
        .mini-nav-cat-panel a[aria-current="page"] {
          background: ${g.accentLight};
          color: ${g.accentDark};
          font-weight: 700;
        }
        @media (max-width: 700px) {
          .mini-nav-cat-panel {
            min-width: 200px;
            max-width: calc(100vw - 32px);
            right: auto;
          }
          /* Anchor right-edge dropdowns to the right so they don't overflow the viewport */
          .mini-nav-cat:nth-last-child(-n+2) .mini-nav-cat-panel { left: auto; right: 0; }
        }
      `}),(0,d.jsxs)("div",{className:"mini-nav-row",children:[(0,d.jsxs)("span",{className:"mini-nav-label",children:["Explore ",a]}),e&&(0,d.jsx)(f(),{href:e.href,className:"mini-nav-chip","aria-current":c===e.href?"page":void 0,children:"Overview"}),h.map(a=>{if(1===a.items.length){let b=a.items[0];return(0,d.jsx)(f(),{href:b.href,className:"mini-nav-chip","aria-current":c===b.href?"page":void 0,children:a.group},a.group)}return(0,d.jsxs)("details",{className:"mini-nav-cat",children:[(0,d.jsxs)("summary",{children:[a.group," ",(0,d.jsx)("span",{className:"mini-nav-cat-count",children:a.items.length})]}),(0,d.jsx)("div",{className:"mini-nav-cat-panel",children:a.items.map(a=>(0,d.jsx)(f(),{href:a.href,"aria-current":c===a.href?"page":void 0,children:a.label},a.href))})]},a.group)})]})]})}}};