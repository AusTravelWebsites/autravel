(()=>{var a={};a.id=3714,a.ids=[3714],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},2112:(a,b,c)=>{"use strict";c.d(b,{m:()=>e,t:()=>f});var d=c(35552);async function e(a){if(!a)return[];try{return(await (0,d.A)`
      SELECT blocked_id AS id FROM user_blocks WHERE blocker_id = ${a}
      UNION
      SELECT blocker_id AS id FROM user_blocks WHERE blocked_id = ${a}`).map(a=>a.id)}catch{return[]}}async function f(a,b){if(!a||!b||a===b)return!1;try{let[c]=await (0,d.A)`
      SELECT 1 FROM user_blocks
      WHERE (blocker_id = ${a} AND blocked_id = ${b})
         OR (blocker_id = ${b} AND blocked_id = ${a})
      LIMIT 1`;return!!c}catch{return!1}}},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},9801:a=>{"use strict";a.exports=import("firebase-admin/app")},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},14276:a=>{"use strict";a.exports=import("firebase-admin/auth")},14985:a=>{"use strict";a.exports=require("dns")},16889:(a,b,c)=>{"use strict";c.a(a,async(a,d)=>{try{c.r(b),c.d(b,{handler:()=>x,patchFetch:()=>w,routeModule:()=>y,serverHooks:()=>B,workAsyncStorage:()=>z,workUnitAsyncStorage:()=>A});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(31157),v=a([u]);u=(v.then?(await v)():v)[0];let y=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/feed/route",pathname:"/api/feed",filename:"route",bundlePath:"app/api/feed/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/var/www/autravel/src/app/api/feed/route.ts",nextConfigOutput:"",userland:u}),{workAsyncStorage:z,workUnitAsyncStorage:A,serverHooks:B}=y;function w(){return(0,g.patchFetch)({workAsyncStorage:z,workUnitAsyncStorage:A})}async function x(a,b,c){var d;let e="/api/feed/route";"/index"===e&&(e="/");let g=await y.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:z,routerServerContext:A,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(z.dynamicRoutes[E]||z.routes[D]);if(F&&!x){let a=!!z.routes[D],b=z.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||y.isDev||x||(G=D,G="/index"===G?"/":G);let H=!0===y.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:z,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>y.onRequestError(a,b,d,A)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>y.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&B&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await y.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})},A),b}},l=await y.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:z,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",B?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await y.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}d()}catch(a){d(a)}})},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},21820:a=>{"use strict";a.exports=require("os")},27910:a=>{"use strict";a.exports=require("stream")},29021:a=>{"use strict";a.exports=require("fs")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},31157:(a,b,c)=>{"use strict";c.a(a,async(a,d)=>{try{c.r(b),c.d(b,{GET:()=>l});var e=c(10641),f=c(86474),g=c(43513),h=c(35552),i=c(2112),j=a([g]);async function k(a){let b=a.cookies.get("__session")?.value;if(!b)return null;try{let a=await (0,g.i)().verifySessionCookie(b,!0);return(await (0,h.db)`SELECT id FROM users WHERE firebase_uid=${a.uid} LIMIT 1`)[0]??null}catch{return null}}async function l(a){try{let{searchParams:b}=new URL(a.url),c=b.get("mode"),d="global"===c?"global":"mine"===c?"mine":"following",f=Math.min(parseInt(b.get("limit")??"10"),50),g=b.get("cursor")??null,j=await k(a);if(("following"===d||"mine"===d)&&!j)return e.NextResponse.json({entries:[],nextCursor:null,hasMore:!1});let l=j?.id?String(j.id):null,m=l?await (0,i.m)(l):[],n=f+1,o=[];if("following"===d&&j&&(o=(await (0,h.db)`SELECT following_id FROM follows WHERE follower_id = ${String(j.id)}::text`).map(a=>String(a.following_id)),0===o.length))return e.NextResponse.json({entries:[],nextCursor:null,hasMore:!1});let p="mine"===d?(0,h.db)`
      SELECT je.id, 'journal' as type,
        COALESCE(je.posted_at, je.created_at) as created_at,
        NULL::text as title, je.body, je.media_urls as photo_urls,
        je.like_count, je.comment_count,
        u.id as user_id, u.username, u.display_name, u.avatar_url, u.travel_status, u.current_location,
        t.id as trip_id, t.title as trip_title, t.slug as trip_slug,
        p.id as place_id, p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug,
        NULL::numeric as rating
      FROM journal_entries je
      JOIN users u ON u.id::text = je.user_id
      LEFT JOIN trips t ON t.id = je.trip_id
      LEFT JOIN places p ON p.id = je.place_id
      WHERE je.user_id = ${l}::text
        AND (${g}::timestamptz IS NULL OR COALESCE(je.posted_at, je.created_at) < ${g}::timestamptz)
      ORDER BY COALESCE(je.posted_at, je.created_at) DESC LIMIT ${n}
    `:"following"===d?(0,h.db)`
      SELECT je.id, 'journal' as type,
        COALESCE(je.posted_at, je.created_at) as created_at,
        NULL::text as title, je.body, je.media_urls as photo_urls,
        je.like_count, je.comment_count,
        u.id as user_id, u.username, u.display_name, u.avatar_url, u.travel_status, u.current_location,
        t.id as trip_id, t.title as trip_title, t.slug as trip_slug,
        p.id as place_id, p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug,
        NULL::numeric as rating
      FROM journal_entries je
      JOIN users u ON u.id::text = je.user_id
      LEFT JOIN trips t ON t.id = je.trip_id
      LEFT JOIN places p ON p.id = je.place_id
      WHERE je.user_id = ANY(${o}::text[])
        AND (${g}::timestamptz IS NULL OR COALESCE(je.posted_at, je.created_at) < ${g}::timestamptz)
      ORDER BY COALESCE(je.posted_at, je.created_at) DESC LIMIT ${n}
    `:(0,h.db)`
      SELECT je.id, 'journal' as type,
        COALESCE(je.posted_at, je.created_at) as created_at,
        NULL::text as title, je.body, je.media_urls as photo_urls,
        je.like_count, je.comment_count,
        u.id as user_id, u.username, u.display_name, u.avatar_url, u.travel_status, u.current_location,
        t.id as trip_id, t.title as trip_title, t.slug as trip_slug,
        p.id as place_id, p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug,
        NULL::numeric as rating
      FROM journal_entries je
      JOIN users u ON u.id::text = je.user_id
      LEFT JOIN trips t ON t.id = je.trip_id
      LEFT JOIN places p ON p.id = je.place_id
      WHERE je.is_public = true
        AND (${g}::timestamptz IS NULL OR COALESCE(je.posted_at, je.created_at) < ${g}::timestamptz)
      ORDER BY COALESCE(je.posted_at, je.created_at) DESC LIMIT ${n}
    `,q="mine"===d?(0,h.db)`
      SELECT c.id, 'checkin' as type, c.created_at,
        NULL::text as title, c.note as body, c.images as photo_urls,
        0 as like_count, 0 as comment_count,
        u.id as user_id, u.username, u.display_name, u.avatar_url, u.travel_status, u.current_location,
        t.id as trip_id, t.title as trip_title, t.slug as trip_slug,
        p.id as place_id, p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug,
        NULL::numeric as rating
      FROM checkins c
      JOIN users u ON u.id::text = c.user_id
      LEFT JOIN trips t ON t.id = c.trip_id
      LEFT JOIN places p ON p.id = c.place_id
      WHERE c.user_id = ${l}::text
        AND (${g}::timestamptz IS NULL OR c.created_at < ${g}::timestamptz)
      ORDER BY c.created_at DESC LIMIT ${n}
    `:"following"===d?(0,h.db)`
      SELECT c.id, 'checkin' as type, c.created_at,
        NULL::text as title, c.note as body, c.images as photo_urls,
        0 as like_count, 0 as comment_count,
        u.id as user_id, u.username, u.display_name, u.avatar_url, u.travel_status, u.current_location,
        t.id as trip_id, t.title as trip_title, t.slug as trip_slug,
        p.id as place_id, p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug,
        NULL::numeric as rating
      FROM checkins c
      JOIN users u ON u.id::text = c.user_id
      LEFT JOIN trips t ON t.id = c.trip_id
      LEFT JOIN places p ON p.id = c.place_id
      WHERE c.user_id = ANY(${o}::text[])
        AND (${g}::timestamptz IS NULL OR c.created_at < ${g}::timestamptz)
      ORDER BY c.created_at DESC LIMIT ${n}
    `:(0,h.db)`
      SELECT c.id, 'checkin' as type, c.created_at,
        NULL::text as title, c.note as body, c.images as photo_urls,
        0 as like_count, 0 as comment_count,
        u.id as user_id, u.username, u.display_name, u.avatar_url, u.travel_status, u.current_location,
        t.id as trip_id, t.title as trip_title, t.slug as trip_slug,
        p.id as place_id, p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug,
        NULL::numeric as rating
      FROM checkins c
      JOIN users u ON u.id::text = c.user_id
      LEFT JOIN trips t ON t.id = c.trip_id
      LEFT JOIN places p ON p.id = c.place_id
      WHERE (${g}::timestamptz IS NULL OR c.created_at < ${g}::timestamptz)
      ORDER BY c.created_at DESC LIMIT ${n}
    `,r="mine"===d?(0,h.db)`
      SELECT r.id, 'review' as type, r.created_at,
        r.title, r.body, r.photo_urls,
        r.like_count, 0 as comment_count,
        u.id as user_id, u.username, u.display_name, u.avatar_url, u.travel_status, u.current_location,
        NULL::uuid as trip_id, NULL::text as trip_title, NULL::text as trip_slug,
        p.id as place_id, p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug,
        r.rating
      FROM reviews r
      JOIN users u ON u.id::text = r.user_id
      LEFT JOIN places p ON p.id = r.place_id
      WHERE r.user_id = ${l}::text
        AND (${g}::timestamptz IS NULL OR r.created_at < ${g}::timestamptz)
      ORDER BY r.created_at DESC LIMIT ${n}
    `:"following"===d?(0,h.db)`
      SELECT r.id, 'review' as type, r.created_at,
        r.title, r.body, r.photo_urls,
        r.like_count, 0 as comment_count,
        u.id as user_id, u.username, u.display_name, u.avatar_url, u.travel_status, u.current_location,
        NULL::uuid as trip_id, NULL::text as trip_title, NULL::text as trip_slug,
        p.id as place_id, p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug,
        r.rating
      FROM reviews r
      JOIN users u ON u.id::text = r.user_id
      LEFT JOIN places p ON p.id = r.place_id
      WHERE r.user_id = ANY(${o}::text[])
        AND (${g}::timestamptz IS NULL OR r.created_at < ${g}::timestamptz)
      ORDER BY r.created_at DESC LIMIT ${n}
    `:(0,h.db)`
      SELECT r.id, 'review' as type, r.created_at,
        r.title, r.body, r.photo_urls,
        r.like_count, 0 as comment_count,
        u.id as user_id, u.username, u.display_name, u.avatar_url, u.travel_status, u.current_location,
        NULL::uuid as trip_id, NULL::text as trip_title, NULL::text as trip_slug,
        p.id as place_id, p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug,
        r.rating
      FROM reviews r
      JOIN users u ON u.id::text = r.user_id
      LEFT JOIN places p ON p.id = r.place_id
      WHERE (${g}::timestamptz IS NULL OR r.created_at < ${g}::timestamptz)
      ORDER BY r.created_at DESC LIMIT ${n}
    `,[s,t,u]=await Promise.all([p,q,r]),v=new Set(m),w=[...s,...t,...u].filter(a=>!v.has(String(a.user_id))).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()),x=w.length>f,y=w.slice(0,f),z=y.length>0?new Date(y[y.length-1].created_at).toISOString():null;return e.NextResponse.json({entries:y.map(a=>({id:a.id,type:a.type,createdAt:a.created_at,title:a.title??null,body:a.body??null,photoUrls:a.photo_urls??[],rating:null!=a.rating?Number(a.rating):null,likeCount:Number(a.like_count??0),commentCount:Number(a.comment_count??0),user:{id:a.user_id,username:a.username,displayName:a.display_name,avatarUrl:a.avatar_url??null,travelStatus:a.travel_status??"home",currentLocation:a.current_location??null},trip:a.trip_id?{id:a.trip_id,title:a.trip_title,slug:a.trip_slug}:null,place:a.place_id?{id:a.place_id,name:a.place_name,city:a.place_city,country:a.place_country,slug:a.place_slug}:null})),nextCursor:z,hasMore:x})}catch(b){return console.error("[feed]",b.message,b.detail),(0,f.i)(b,"feed",a)}}g=(j.then?(await j)():j)[0],d()}catch(a){d(a)}})},34631:a=>{"use strict";a.exports=require("tls")},35552:(a,b,c)=>{"use strict";c.d(b,{A:()=>l,db:()=>h});var d=c(49122);(0,c(14985).setDefaultResultOrder)("ipv4first");let e=process.env.DATABASE_URL_TX_POOL||process.env.DATABASE_URL_POOL||process.env.DATABASE_URL;if(!e)throw Error("DATABASE_URL_TX_POOL or DATABASE_URL_POOL or DATABASE_URL environment variable is required");let f=process.env.DB_SCHEMA||"autravel",g=/@(127\.0\.0\.1|localhost)\b/.test(e),h=(0,d.A)(e,{ssl:!g&&"require",max:10,idle_timeout:8,max_lifetime:120,connect_timeout:8,prepare:!1,connection:{application_name:"autravel",search_path:`${f}, public`,statement_timeout:"12000",idle_in_transaction_session_timeout:"15000"}});"undefined"==typeof process||process.__autravelUnhandledHandlerInstalled||(process.__autravelUnhandledHandlerInstalled=!0,process.on("unhandledRejection",a=>{console.warn("[autravel unhandledRejection caught]",String(a&&(a.message||a)||"unknown").slice(0,300))}));let i=["articles","localities","destinations","park_nearby","park_nearby_meta","destination_nearby","destination_nearby_meta","destination_climate","destination_marine","distance_pairs","alerts","tour_sync_log","wp_import_log","newsletter_subscribers","uptime_probes","uptime_incidents","site_settings","redirect_404s","redirect_groups"],j=!1,k=0;!function(){if(j||"phase-production-build"===process.env.NEXT_PHASE)return;j=!0;let a=i.map(a=>`q.query ILIKE '%${a}%'`).join(" OR ");setInterval(async()=>{if(Date.now()<k)return;let b=null;try{for(let c of(b=(0,d.A)(e,{ssl:!g&&"require",prepare:!1,max:1,connect_timeout:4,idle_timeout:3}),await b.unsafe(`
        SELECT pid, EXTRACT(EPOCH FROM (NOW() - query_start))::int AS secs,
               LEFT(query, 80) AS q
        FROM pg_stat_activity AS q
        WHERE datname = current_database()
          AND state = 'active' AND wait_event = 'ClientRead'
          AND application_name = 'Supavisor'
          AND query_start < NOW() - INTERVAL '20 seconds'
          AND query NOT ILIKE '%pg_stat_activity%'
          AND (${a})
      `)))try{await b.unsafe(`SELECT pg_terminate_backend(${Number(c.pid)})`),console.warn(`[autravel self-heal] terminated leaked backend pid=${c.pid} stuck=${c.secs}s q="${c.q.replace(/\s+/g," ").slice(0,120)}"`)}catch(a){console.warn(`[autravel self-heal] terminate pid=${c.pid} failed: ${a?.message}`)}}catch(a){console.warn("[autravel self-heal] tick failed:",a?.message),k=Date.now()+12e4}finally{try{await b?.end({timeout:2})}catch{}}},6e4).unref()}();let l=h},43513:(a,b,c)=>{"use strict";c.a(a,async(a,d)=>{try{c.d(b,{Q:()=>h,i:()=>i});var e=c(9801),f=c(14276),g=a([e,f]);[e,f]=g.then?(await g)():g;let h=()=>(0,f.getAuth)(function(){let a;if((0,e.getApps)().length>0)return(0,e.getApps)()[0];let b=process.env.FIREBASE_SERVICE_ACCOUNT_JSON||"{}";if(b.length<100)throw Error(`FIREBASE_SERVICE_ACCOUNT_JSON looks truncated (len=${b.length}). Wrap the value in single quotes in .env.local: FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'`);try{a=JSON.parse(b)}catch{let c=b.replace(/"private_key"\s*:\s*"([\s\S]*?)"/g,(a,b)=>`"private_key": "${b.replace(/\n/g,"\\n").replace(/\r/g,"")}"`);a=JSON.parse(c)}return(0,e.initializeApp)({credential:(0,e.cert)(a),projectId:"bug-bitten"})}()),i=h;d()}catch(a){d(a)}})},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:a=>{"use strict";a.exports=require("crypto")},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},74998:a=>{"use strict";a.exports=require("perf_hooks")},78335:()=>{},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},86474:(a,b,c)=>{"use strict";c.d(b,{i:()=>f,w:()=>g});var d=c(10641),e=c(35552);function f(a,b,c){let e=a instanceof Error?a.message:String(a),f=a instanceof Error?a.stack:void 0;return console.error(b?`[${b}]`:"[server error]",e,f||""),g({message:e.slice(0,800),stack:f?.slice(0,4e3),context:b,req:c}).catch(()=>{}),d.NextResponse.json({error:"Internal server error"},{status:500})}async function g(a){try{let b=a.req?new URL(a.req.url).pathname:a.context||null,c=a.req?.headers.get("user-agent")?.slice(0,400)||null,d=a.req&&(a.req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||a.req.headers.get("cf-connecting-ip")?.trim()||a.req.headers.get("x-real-ip")?.trim())||null;await (0,e.db)`
      INSERT INTO client_errors (message, stack, url, route, status_code, user_agent, ip, source)
      VALUES (${a.message}, ${a.stack??null}, ${b}, ${b}, ${a.statusCode??500}, ${c}, ${d}, 'server')`}catch(a){console.error("[logServerError]",a instanceof Error?a.message:String(a))}}},91645:a=>{"use strict";a.exports=require("net")},96487:()=>{}};var b=require("../../../webpack-runtime.js");b.C(a);var c=b.X(0,[5873,9172,1692],()=>b(b.s=16889));module.exports=c})();