// npm run sign:firefox → builds, then has Mozilla sign dist/firefox as an unlisted add-on (.xpi in dist/signed/).
// Reads WEB_EXT_API_KEY / WEB_EXT_API_SECRET from .env (Node >= 20.12) or from the environment.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (existsSync('.env')) process.loadEnvFile('.env');
if (!process.env.WEB_EXT_API_KEY || !process.env.WEB_EXT_API_SECRET) {
  console.error('WEB_EXT_API_KEY / WEB_EXT_API_SECRET fehlen. Siehe .env.example und README.');
  process.exit(1);
}
const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true }); if (r.status) process.exit(r.status); };
run('node', ['build.mjs']);
run('npx', ['--yes', 'web-ext@10', 'sign', '--channel=unlisted', '--source-dir=dist/firefox', '--artifacts-dir=dist/signed']);
