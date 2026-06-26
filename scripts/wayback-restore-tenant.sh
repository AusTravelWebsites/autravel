#!/bin/bash
# Per-tenant Wayback restore pipeline:
#   1. Pull CDX dump from web.archive.org for the tenant's domain
#   2. Cross-reference unredirected 404 paths against the CDX
#   3. Save a targets file
#   4. Run restore-articles-from-wayback.mjs as drafts
#
# Usage:
#   ./wayback-restore-tenant.sh <state_code> <domain>
# Example:
#   ./wayback-restore-tenant.sh qld qldtravel.com.au
#
# All output to /tmp/wayback-<state>.{cdx.json,targets.json,log}.

set -u
STATE="${1:?need state}"
DOMAIN="${2:?need domain}"
cd /var/www/autravel
PG_PWD=$(grep -E '^DATABASE_URL=' .env.local | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|' | head -1)
DB="postgresql://autravel:${PG_PWD}@127.0.0.1:5432/autravel"

ts() { date +"%H:%M:%S"; }
echo "[$(ts)] === $STATE / $DOMAIN ==="

CDX=/tmp/wayback-${STATE}.cdx.json
TARGETS=/tmp/wayback-${STATE}.targets.json
LOG=/tmp/wayback-${STATE}.log

# 1. CDX (skip if already fetched today)
if [ -s "$CDX" ] && find "$CDX" -mtime -1 | grep -q .; then
  echo "[$(ts)] CDX cached ($(stat -c %s "$CDX") bytes)"
else
  echo "[$(ts)] fetching CDX for $DOMAIN ..."
  curl -sS --max-time 120 "http://web.archive.org/cdx/search/cdx?url=${DOMAIN}/*&output=json&filter=statuscode:200&filter=mimetype:text/html&from=20180101" -o "$CDX"
  echo "[$(ts)] CDX got $(stat -c %s "$CDX") bytes"
fi

# 2. Build targets file (intersect 404 log with CDX captures)
echo "[$(ts)] building targets ..."
/usr/pgsql-17/bin/psql "$DB" -A -F$'\t' -t -c "
SELECT r4.path, r4.hit_count
FROM autravel.redirect_404s r4
LEFT JOIN autravel.redirects r ON r.from_path = r4.path AND r.is_active AND COALESCE(r.state_code,'') = COALESCE(r4.state_code,'')
WHERE r4.state_code = '$STATE' AND r.id IS NULL
" > /tmp/wayback-${STATE}.404s.tsv

python3 <<PY
import json, re
from urllib.parse import urlparse
try:
    data = json.load(open('$CDX'))
except Exception as e:
    print('CDX parse failed:', e); raise SystemExit(1)
paths = {}
for row in data[1:]:
    ts_, url = row[1], row[2]
    try:
        p = urlparse(url if url.startswith('http') else 'http://' + url).path
        if p.endswith('/embed/') or not p: continue
        if '.' not in p.split('/')[-1] and not p.endswith('/'): p = p + '/'
        if p not in paths or paths[p] < ts_: paths[p] = ts_
    except: pass

todo = []
for line in open('/tmp/wayback-${STATE}.404s.tsv'):
    parts = line.rstrip('\n').split('\t')
    if len(parts) >= 2 and parts[0]:
        try: todo.append((parts[0], int(parts[1])))
        except: pass

hits = []
seen = set()
for path, _ in todo:
    cp = path.split('?')[0].split('#')[0]
    if '.' not in cp.split('/')[-1] and not cp.endswith('/'): cp = cp + '/'
    if cp in seen: continue
    if cp in paths:
        seen.add(cp)
        hits.append({'path': cp, 'timestamp': paths[cp]})

# Drop known-junk paths that aren't worth restoring
keep = []
for t in hits:
    p = t['path']
    if any(p.startswith(prefix) for prefix in ['/sitemap/', '/enquire.html', '/search.html', '/tariffs/', '/specials/', '/wp-content/', '/wp-admin/', '/info-files/']):
        continue
    if '/embed/' in p or '%20' in p or p.endswith('.pdf') or p.endswith('.jpg'):
        continue
    keep.append(t)

print(f'{len(todo)} unredirected 404s; {len(hits)} have Wayback snapshots; {len(keep)} after filtering junk')
json.dump(keep, open('$TARGETS','w'), indent=2)
PY

# 3. Run restore
if [ ! -s "$TARGETS" ]; then
  echo "[$(ts)] no targets — nothing to do"; exit 0
fi
TARGET_COUNT=$(python3 -c "import json; print(len(json.load(open('$TARGETS'))))")
echo "[$(ts)] starting restore of $TARGET_COUNT articles ..."
node --env-file=.env.local scripts/restore-articles-from-wayback.mjs \
  --state "$STATE" --domain "$DOMAIN" --targets "$TARGETS" --status draft \
  > "$LOG" 2>&1
ATTEMPTED=$(grep -c '^→ ' "$LOG" 2>/dev/null || echo 0)
echo "[$(ts)] $STATE done — attempted=$ATTEMPTED  log=$LOG"
