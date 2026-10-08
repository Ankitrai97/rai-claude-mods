// Starts daemon.mjs detached from the mod (so it outlives this call and serves every session),
// with its output in <data dir>/daemon.log, then exits at once.
// Usage: node start.mjs <data dir>
import { spawn } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const data = process.argv[2];
if (!data) {
  process.stderr.write('usage: node start.mjs <data dir>\n');
  process.exit(2);
}
mkdirSync(data, { recursive: true });
const out = openSync(join(data, 'daemon.log'), 'a');
const child = spawn(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'daemon.mjs'), data], {
  cwd: homedir(),
  detached: true,
  windowsHide: true,
  stdio: ['ignore', out, out],
});
child.unref();
process.stdout.write(`started ${child.pid}\n`);
