#!/bin/bash
# Sequential Wayback restore for every autravel tenant.
# Built 2026-06-26 — runs in background, takes 5-7 hours overnight.
#
# Per tenant: fetch CDX, intersect with 404 log, filter noise, restore drafts.
# Each tenant's restore writes its own progress log under /tmp/wb-<state>.log.

set -u
cd /var/www/autravel
PG_PWD=$(grep -E '^DATABASE_URL=' .env.local | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|' | head -1)
DB="postgresql://autravel:${PG_PWD}@127.0.0.1:5432/autravel"
PSQL="/usr/pgsql-17/bin/psql"

# state_code → domain
declare -A DOMAINS=(
  [nsw]=nswtravel.com.au
  [qld]=qldtravel.com.au
  [vic]=victravel.com.au
  [sa]=satravel.net.au
  [tas]=tastravel.net.au
  [nt]=nttravel.com.au
  [aunz]=aunztravel.com.au
  [uk]=new-forest-national-park.com
)

# Order: smaller first so progress is visible quickly
ORDER="tas uk aunz vic sa nt qld nsw"

LOG=/var/www/autravel/logs/restore-all.log
mkdir -p /var/www/autravel/logs
echo "=== STARTED $(date '+%Y-%m-%d %H:%M') ===" | tee -a "$LOG"

for STATE in $ORDER; do
  DOMAIN="${DOMAINS[$STATE]}"
  echo "" | tee -a "$LOG"
  echo "════════ $STATE ($DOMAIN) ════════ $(date '+%H:%M')" | tee -a "$LOG"

  # 1. Pull this tenant's unredirected 404 paths
  TARGETS_404=/tmp/wb-${STATE}-paths.tsv
  $PSQL "$DB" -A -F$'\t' -t -c "
    SELECT r4.path, r4.hit_count
    FROM autravel.redirect_404s r4
    LEFT JOIN autravel.redirects r
      ON r.from_path = r4.path AND r.is_active
     AND COALESCE(r.state_code,'') = COALESCE(r4.state_code,'')
    WHERE r4.state_code = '$STATE' AND r.id IS NULL
  " > "$TARGETS_404"
  N_404=$(wc -l < "$TARGETS_404")
  echo "  unredirected 404s: $N_404" | tee -a "$LOG"

  # 2. Fetch CDX for the domain (90s timeout, fall back to short on error)
  CDX_JSON=/tmp/wb-${STATE}-cdx.json
  curl -sS --max-time 120 "http://web.archive.org/cdx/search/cdx?url=${DOMAIN}/*&output=json&filter=statuscode:200&filter=mimetype:text/html&from=20180101" -o "$CDX_JSON" 2>&1
  N_CDX=$(wc -l < "$CDX_JSON" 2>/dev/null)
  echo "  CDX rows: $N_CDX" | tee -a "$LOG"
  if [ "${N_CDX:-0}" -lt 2 ]; then
    echo "  ✗ CDX empty/invalid — skipping $STATE" | tee -a "$LOG"
    continue
  fi

  # 3. Match + filter noise + dedupe → targets file
  TARGETS_JSON=/tmp/wb-${STATE}-targets.json
  python3 - "$TARGETS_404" "$CDX_JSON" "$TARGETS_JSON" <<'PY'
import sys, json
from urllib.parse import urlparse
paths_404 = []
for line in open(sys.argv[1]):
    parts = line.rstrip('\n').split('\t')
    if len(parts) < 2: continue
    try: paths_404.append({'path': parts[0], 'hits': int(parts[1])})
    except: pass
data = json.load(open(sys.argv[2]))
wb = {}
for row in data[1:]:
    ts, url = row[1], row[2]
    try:
        p = urlparse(url if url.startswith('http') else 'http://' + url).path
        if p.endswith('/embed/'): continue
        if '.' not in p.split('/')[-1] and not p.endswith('/'): p += '/'
        if p not in wb or wb[p] < ts: wb[p] = ts
    except: pass
NOISE = ('/sitemap/', '/enquire.html', '/search.html', '/tariffs/', '/specials/', '/wp-content/', '/wp-admin/', '/info-files/', '/_next', '/.well-known')
def canon(p):
    p = p.split('?')[0].split('#')[0]
    if '.' not in p.split('/')[-1] and not p.endswith('/'): p += '/'
    return p
out = []
seen = set()
for t in paths_404:
    cp = canon(t['path'])
    if any(cp.startswith(n) for n in NOISE): continue
    if cp.endswith(('.pdf','.jpg','.gif','.png','.css','.js')): continue
    if cp in seen: continue
    seen.add(cp)
    if cp in wb:
        out.append({'path': cp, 'timestamp': wb[cp]})
    else:
        # case-insensitive fallback
        for k, ts in wb.items():
            if k.lower() == cp.lower():
                out.append({'path': cp, 'timestamp': ts})
                break
json.dump(out, open(sys.argv[3], 'w'), indent=2)
print(f'  matched: {len(out)} / {len(paths_404)} (filtered for noise)')
PY

  N_RESTORE=$(python3 -c "import json; print(len(json.load(open('$TARGETS_JSON'))))" 2>/dev/null || echo 0)
  echo "  to restore: $N_RESTORE" | tee -a "$LOG"
  if [ "${N_RESTORE:-0}" -eq 0 ]; then
    echo "  (nothing to restore for $STATE)" | tee -a "$LOG"
    continue
  fi

  # 4. Run the per-tenant restore
  RESTORE_LOG=/tmp/wb-${STATE}-restore.log
  /root/.nvm/versions/node/v22.22.2/bin/node --env-file=.env.local scripts/restore-articles-from-wayback.mjs \
    --state "$STATE" --domain "$DOMAIN" --targets "$TARGETS_JSON" --status draft \
    > "$RESTORE_LOG" 2>&1
  OK=$(grep -c "^→ " "$RESTORE_LOG")
  FAIL=$(grep -c "^  ✗" "$RESTORE_LOG")
  echo "  ✓ $STATE done: attempted=$OK fail=$FAIL (log: $RESTORE_LOG)" | tee -a "$LOG"
done

echo "" | tee -a "$LOG"
echo "=== FINISHED $(date '+%Y-%m-%d %H:%M') ===" | tee -a "$LOG"
