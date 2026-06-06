// PM2 config for autravel — 3 redundant instances behind a haproxy load
// balancer (haproxy on :3010, see /etc/haproxy/haproxy.cfg).
//
// Why 3 instances: all 8 AU travel sites run from this one codebase. A single
// Next.js process wedges periodically (event-loop / streaming hang — process
// stays alive but stops serving). With one process that is an 8-site outage.
// With 3 behind a health-checked balancer, a wedged instance is ejected in
// ~6s and the other 2 serve every request — users see nothing.
//
// All 3 share the same build dir (/var/www/autravel/.next). Next.js writes
// its ISR/fetch cache atomically (temp file + rename) so concurrent instances
// sharing the dir is safe; autravel revalidates infrequently anyway.
//
// cron_restart is staggered 2h apart so a scheduled restart never takes more
// than one instance down at a time.
//
// Usage:
//   pm2 start /var/www/autravel/ecosystem.config.js
//   pm2 restart autravel-1   (etc.)
//   pm2 logs autravel-2
const base = {
  cwd: '/var/www/autravel',
  script: 'node_modules/.bin/next',
  interpreter: '/root/.nvm/versions/node/v22.22.2/bin/node',
  exec_mode: 'fork',
  instances: 1,
  watch: false,
  autorestart: true,
  max_memory_restart: '1500M',
  merge_logs: true,
  time: true,
}

module.exports = {
  apps: [
    {
      ...base,
      name: 'autravel-1',
      args: 'start -p 3001',
      cron_restart: '0 0,6,12,18 * * *',
      env: { NODE_ENV: 'production', PORT: '3001' },
      error_file: '/var/www/autravel/logs/pm2-error-1.log',
      out_file: '/var/www/autravel/logs/pm2-out-1.log',
    },
    {
      ...base,
      name: 'autravel-2',
      args: 'start -p 3100',
      cron_restart: '0 2,8,14,20 * * *',
      env: { NODE_ENV: 'production', PORT: '3100' },
      error_file: '/var/www/autravel/logs/pm2-error-2.log',
      out_file: '/var/www/autravel/logs/pm2-out-2.log',
    },
    {
      ...base,
      name: 'autravel-3',
      args: 'start -p 3101',
      cron_restart: '0 4,10,16,22 * * *',
      env: { NODE_ENV: 'production', PORT: '3101' },
      error_file: '/var/www/autravel/logs/pm2-error-3.log',
      out_file: '/var/www/autravel/logs/pm2-out-3.log',
    },
  ],
}
