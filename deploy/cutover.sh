#!/bin/bash
# Cutover a single WHM account from WP → autravel on port 3001.
#
# Usage:
#   ./deploy/cutover.sh <cpanel-acct> <domain>
#
# Example:
#   ./deploy/cutover.sh qldtravel qldtravel.com.au
#
# What it does:
#   1. Drops the tenant-specific proxy.conf into both SSL and non-SSL userdata dirs
#   2. Rebuilds Apache config via /scripts/rebuildhttpdconf
#   3. Reloads httpd (LiteSpeed on this box)
#
# What it preserves:
#   - WP /wp-content/* and /wp-includes/* continue to serve from disk
#     (so images embedded in migrated article body_html still resolve)
#   - .well-known for Let's Encrypt cert renewal
#
# Rollback:
#   rm -f /etc/apache2/conf.d/userdata/{ssl,std}/2_4/<acct>/<domain>/proxy.conf
#   /scripts/rebuildhttpdconf && /scripts/restartsrv_httpd
set -euo pipefail

ACCT="${1:?usage: cutover.sh <cpanel-acct> <domain>}"
DOMAIN="${2:?usage: cutover.sh <cpanel-acct> <domain>}"
SRC="$(dirname "$0")/qldtravel-proxy.conf"
if [ ! -f "$SRC" ]; then
  echo "Template proxy.conf missing: $SRC" >&2
  exit 1
fi

SSL_DIR="/etc/apache2/conf.d/userdata/ssl/2_4/$ACCT/$DOMAIN"
STD_DIR="/etc/apache2/conf.d/userdata/std/2_4/$ACCT/$DOMAIN"

for d in "$SSL_DIR" "$STD_DIR"; do
  if [ ! -d "$d" ]; then
    echo "Expected userdata dir not found: $d" >&2
    echo "(is this the right account + domain?)" >&2
    exit 1
  fi
done

# Instantiate — replace the hardcoded qldtravel paths with the real acct.
# Uses `install` so existing proxy.confs are replaced without interactive prompts.
TMP=$(mktemp)
sed "s|qldtravel|$ACCT|g" "$SRC" > "$TMP"

install "$TMP" "$SSL_DIR/proxy.conf"
install "$TMP" "$STD_DIR/proxy.conf"
rm -f "$TMP"

echo "Wrote proxy.conf to:"
echo "  $SSL_DIR/proxy.conf"
echo "  $STD_DIR/proxy.conf"

echo "Rebuilding Apache config..."
/scripts/rebuildhttpdconf

echo "Restarting httpd..."
/scripts/restartsrv_httpd

echo ""
echo "Cutover complete. Verify with:"
echo "  curl -sI -H 'Host: $DOMAIN' https://127.0.0.1/"
echo "  curl -sI https://$DOMAIN/"
