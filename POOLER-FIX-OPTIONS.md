# autravel / shared-Supabase pooler outage — durable fix options

**Incident (2026-06-03):** qldtravel (all tenants) intermittently timing out ~50–65% of
requests. Root cause: the shared Supabase project (ctdkjmhrumbdsvxpyejk) hit its
**60-connection cap** — `pg_stat_activity` showed 40 backends, **30 idle, oldest idle 8 days**
(long-lived backends held by sibling apps on the *session* pooler). New connections from the
autravel web instances via the **transaction pooler (:6543)** got `CONNECT_TIMEOUT`, queries hit
the 12s statement timeout, and autravel-1/2/3 crash-looped (51–54 restarts).
A rolling restart cleared autravel's own connections and restored service — but the underlying
60-conn contention remains. (Aggravated today by a 12-parallel 404 audit sweep.)

## Options

### A. Move bugbitten to the transaction pooler (low cost, structural)
bugbitten still uses the **session** pooler (:5432), which pins one real Postgres backend per
client connection for the whole session — those are the 8-day idle zombies eating the cap.
Switching bugbitten to the **transaction** pooler (:6543) + `prepare:false` (exactly what
autravel already runs) returns backends after each transaction, dropping the shared footprint
to near-zero steady-state.
- **Cost:** $0. **Effort:** ~30 min + a bugbitten redeploy. **Risk:** low (autravel has run this
  way since 2026-05-20). Must set `prepare:false` or prepared-statement errors appear.
- This is the fix the existing memory already flagged as overdue.

### B. Upgrade the shared project to Supabase Pro (money fixes it)
Pro raises the connection limit well above 60 and adds headroom for all sibling apps.
- **Cost:** ~US$25/mo. **Effort:** minutes (dashboard). **Risk:** none.
- Best if you'd rather not touch bugbitten's DB layer, or want margin for future apps.

### C. Tighten per-app connection caps + add a zombie reaper (band-aid)
Lower `max` per instance and/or run a periodic `pg_terminate_backend` of >N-minute idle backends.
- **Cost:** $0. **Effort:** ~1h. **Risk:** med — capping too low starves the app under load;
  terminating backends can disrupt sibling apps. Treats symptoms, not cause.

## Recommendation
**A now, B if it recurs.** Moving bugbitten off the session pooler is the real structural fix and
is free; keep Pro ($25/mo) as the ready escalation if contention returns. (Matches the
"don't band-aid; escalate" reliability ladder.) Option C only as an interim if neither A nor B
can happen immediately.
