#!/bin/bash
# Nightly safety-net snapshot of /var/www/autravel.
# Commits any local changes and pushes to origin (github.com/AusTravelWebsites/autravel).
# Wired by cron at 04:00 AEST. Idempotent — if working tree is clean, exits 0 silently.

set -u
cd /var/www/autravel || exit 1
export GIT_SSH_COMMAND="ssh -i /root/.ssh/id_ed25519_gh_autravel -o IdentitiesOnly=yes"

STAMP=$(date '+%Y-%m-%d %H:%M %Z')

# Fast bail-out if nothing changed
if [ -z "$(git status --porcelain)" ]; then
  echo "[$STAMP] clean — no commit needed"
  exit 0
fi

# Commit + push. If push fails (network, auth), the commit still lands locally
# so we don't lose state; cron will retry tomorrow.
git add -A
git commit -m "nightly snapshot $STAMP" || { echo "[$STAMP] commit failed"; exit 1; }

if git push origin main; then
  echo "[$STAMP] pushed $(git rev-parse --short HEAD)"
else
  echo "[$STAMP] push FAILED — commit retained locally, will retry tomorrow"
  exit 1
fi
