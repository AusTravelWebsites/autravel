# perthtourism.com.au → autravel cutover

perthtourism.com.au is a **standalone autravel tenant** (`state_code: 'perth'`, trails-first,
WA-wide). The domain currently serves a live WordPress site on cPanel account **`perth`**
(`/home/perth/public_html`, ea-php83). These steps repoint it at the autravel Next.js app
(haproxy `:3010`). **Do not run until the rebuild is signed off** — it replaces the live WP site.

The tenant is already testable before cutover, via the loopback app:

```bash
curl -s -H 'Host: perthtourism.com.au' http://localhost:3010/ | head
curl -s -H 'Host: perthtourism.com.au' http://localhost:3010/walks/ | head
```

## Go-live steps

1. **Back up the WordPress site** (account `perth`) — full cPanel backup + DB dump, kept off-box.

2. **Install the Apache proxy config** (both SSL and non-SSL vhosts):

   ```bash
   install -D -m 0644 deploy/perthtourism/proxy.conf \
     /etc/apache2/conf.d/userdata/ssl/2_4/perth/perthtourism.com.au/proxy.conf
   install -D -m 0644 deploy/perthtourism/proxy.conf \
     /etc/apache2/conf.d/userdata/std/2_4/perth/perthtourism.com.au/proxy.conf
   /usr/local/cpanel/scripts/ensure_vhost_includes --user=perth
   apachectl configtest && apachectl graceful
   ```

3. **Verify through the public edge** (Cloudflare → LiteSpeed → haproxy → app):

   ```bash
   curl -sI https://perthtourism.com.au/ | head
   curl -sI https://perthtourism.com.au/walks/ | head
   ```

4. **GA4** — create the Perth Tourism GA4 property and either set `gaId` in
   `src/lib/tenants.ts` (perth) and redeploy, or add the tag via `/admin/snippets`
   scoped to `state_code='perth'`.

5. **Mail** — confirm `info@perthtourism.com.au` (contact form inbox) and a
   Resend-verified `noreply@perthtourism.com.au` sender exist.

6. **Stagger SEO changes** — don't bulk-submit; let the new sitemap
   (`https://perthtourism.com.au/sitemap.xml`) be discovered, and roll out any further
   redirect/content tweaks over days (anti-AI-footprint).

## Rollback

Remove the two `proxy.conf` files, re-run `ensure_vhost_includes --user=perth`, `apachectl graceful`.
The original WordPress docroot at `/home/perth/public_html` is untouched by the proxy.
