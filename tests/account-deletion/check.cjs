// Local tests only: no Supabase client, credentials, or real account requests.
const { build } = require('esbuild');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

(async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'musclemax-account-deletion-tests-'));
  try {
    const outfile = path.join(temp, 'tests.cjs');
    await build({ entryPoints: [path.join(__dirname, 'account-deletion.test.ts')], bundle: true, platform: 'node', format: 'cjs', outfile, logLevel: 'silent' });
    const run = spawnSync(process.execPath, ['--test', outfile], { stdio: 'inherit' });
    process.exitCode = run.status ?? 1;
  } finally { await rm(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
