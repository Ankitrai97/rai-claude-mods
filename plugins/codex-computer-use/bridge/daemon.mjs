// Serves Codex's computer-use engine (via launch.mjs) to the codex-cu Claude Code mod, with one
// engine per caller so several Claude sessions can drive the desktop at the same time.
//
// Usage: node daemon.mjs <data dir>
// Listens on 127.0.0.1 on a free port and writes { port, token, version, pid } to
// <data dir>/daemon.json. Every request must carry that token in the x-codex-cu-token header.
//
// POST /js    {code, timeout_ms, title, session?, approve?}
// POST /reset {session?}
// GET  /health    -> "ok v3"
// GET  /sessions  -> JSON: callers, their apps, leases, last use
// POST /end   {session}  -> stops that caller's engine (and its subagents': session/<agent>), freeing its leases
// POST /quit      -> shuts down
//
// Approvals: Codex asks before using each app (an MCP elicitation, "Allow Codex to use X?"). It
// is accepted only for apps that caller lists in `approve` (the person's Allow presses in that
// session) or that <data dir>/always-allowed.json lists (Always allow, or autoApproveAll);
// anything else is declined and reported in the x-codex-declined header.
//
// App leases: the first caller to use an app leases it; another caller asking for the same app
// while the lease is fresh is declined and told in the x-codex-busy header.
//
// Idle callers' engines stop after SERVER_IDLE_MS; the daemon exits after IDLE_MS with no calls.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const VERSION = 'v3';
const here = dirname(fileURLToPath(import.meta.url));
const DATA = process.argv[2];
if (!DATA) {
  process.stderr.write('usage: node daemon.mjs <data dir>\n');
  process.exit(2);
}
mkdirSync(DATA, { recursive: true });
const STATE = join(DATA, 'daemon.json');
const ALWAYS = join(DATA, 'always-allowed.json');
const TOKEN = randomBytes(24).toString('hex');
const IDLE_MS = 30 * 60 * 1000;
const SERVER_IDLE_MS = 15 * 60 * 1000;
const LEASE_MS = 2 * 60 * 1000;
const MAX_SERVERS = 8;
// sky reports these when it cannot reach the running Codex app
const NO_PIPE = /native pipe (is unavailable|path is unavailable|connection timed out)/i;

const readAlways = () => {
  try {
    return JSON.parse(readFileSync(ALWAYS, 'utf8'));
  } catch {
    return {};
  }
};
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const isAlwaysAllowed = app => {
  const always = readAlways();
  return always.autoApproveAll === true || (always.apps ?? []).some(one => same(one, app));
};
const log = (...parts) => process.stderr.write(`${new Date().toISOString()} ${parts.join(' ')}\n`);

// The app's display name: Windows sends it in tool_params_display; macOS quotes it in the message.
const appOf = params => {
  const shown = params?._meta?.tool_params_display?.find(p => p.name === 'app')?.value;
  if (typeof shown === 'string' && shown.trim()) return shown.trim();
  const message = String(params?.message ?? '');
  return /use "([^"]+)"/.exec(message)?.[1] ?? /use (.+?)\?\s*$/.exec(message)?.[1] ?? message;
};

// caller key -> { child, rpc, ready, queue, lastUsed, apps:Set, call, helperMode }
const servers = new Map();
// app name -> caller key
const leases = new Map();
let idle;
const touch = () => { clearTimeout(idle); idle = setTimeout(shutdown, IDLE_MS); };

const keyOf = raw => String(raw ?? '').trim().slice(0, 200) || 'default';

function leaseHolder(app, key) {
  const holder = leases.get(app);
  if (!holder || holder === key) return null;
  const s = servers.get(holder);
  if (!s || (!s.call && Date.now() - s.lastUsed > LEASE_MS)) {
    leases.delete(app);
    return null;
  }
  return { app, holder, idleSeconds: s.call ? 0 : Math.round((Date.now() - s.lastUsed) / 1000) };
}

function releaseLeases(key) {
  for (const [app, holder] of leases) if (holder === key) leases.delete(app);
}

function startServer(key, helperMode = false) {
  const child = spawn(process.execPath, [join(here, 'launch.mjs')], {
    stdio: ['pipe', 'pipe', 'inherit'],
    windowsHide: true,
    env: { ...process.env, CODEX_CU_HELPER_MODE: helperMode ? '1' : '0' },
  });
  let nextId = 1;
  const pending = new Map();
  const s = { child, rpc: null, ready: null, queue: Promise.resolve(), lastUsed: Date.now(), apps: new Set(), call: null, helperMode };
  const send = m => child.stdin.write(JSON.stringify(m) + '\n');
  s.rpc = (method, params) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    send({ jsonrpc: '2.0', id, method, params });
  });
  createInterface({ input: child.stdout }).on('line', line => {
    let m; try { m = JSON.parse(line); } catch { return; }
    if (m.method && m.id !== undefined) {
      if (m.method === 'elicitation/create') {
        const app = appOf(m.params);
        const call = s.call ?? { approve: [], declined: [], busy: [] };
        const busy = leaseHolder(app, key);
        if (busy) {
          call.busy.push(busy);
          send({ jsonrpc: '2.0', id: m.id, result: { action: 'decline' } });
        } else if (call.approve.some(one => same(one, app)) || isAlwaysAllowed(app)) {
          leases.set(app, key);
          s.apps.add(app);
          send({ jsonrpc: '2.0', id: m.id, result: { action: 'accept', content: {} } });
        } else {
          call.declined.push(app);
          send({ jsonrpc: '2.0', id: m.id, result: { action: 'decline' } });
        }
      } else send({ jsonrpc: '2.0', id: m.id, result: {} });
    } else if (m.id !== undefined && pending.has(m.id)) {
      pending.get(m.id).resolve(m);
      pending.delete(m.id);
    }
  });
  child.on('exit', () => {
    for (const p of pending.values()) p.reject(new Error('Codex computer-use engine exited; see daemon.log'));
    if (servers.get(key)?.child === child) {
      servers.delete(key);
      releaseLeases(key);
    }
  });
  s.ready = s.rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: { elicitation: {} },
    clientInfo: { name: 'codex-cu-daemon', version: VERSION },
  }).then(() => send({ jsonrpc: '2.0', method: 'notifications/initialized' }));
  servers.set(key, s);
  log('started engine for', key, helperMode ? '(bundled helper)' : '(Codex app pipe)', `(${servers.size} running)`);
  return s;
}

function stopServer(key, why) {
  const s = servers.get(key);
  if (!s) return;
  servers.delete(key);
  releaseLeases(key);
  s.child.kill();
  log('stopped engine for', key, why);
}

function makeRoom() {
  if (servers.size < MAX_SERVERS) return true;
  const quiet = [...servers].filter(([, s]) => !s.call).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  if (quiet.length === 0) return false;
  stopServer(quiet[0][0], 'to make room');
  return true;
}

function serverFor(key, helperMode) {
  const s = servers.get(key);
  if (s) return s;
  if (!makeRoom()) return null;
  return startServer(key, helperMode);
}

async function callOnce(key, name, args, approve, helperMode) {
  const s = serverFor(key, helperMode);
  if (!s) {
    return { text: `Codex computer use is busy: ${MAX_SERVERS} sessions are mid-call. Try again in a moment.`, isError: true, declined: [], busy: [] };
  }
  const run = s.queue.then(async () => {
    await s.ready;
    s.lastUsed = Date.now();
    s.call = { approve, declined: [], busy: [] };
    try {
      const m = await s.rpc('tools/call', { name, arguments: args });
      const r = m.result ?? { content: [{ type: 'text', text: JSON.stringify(m.error) }], isError: true };
      const text = r.content.map(b => (b.type === 'text' ? b.text : b.type === 'image' ? saveImage(b) : `[${b.type} omitted]`)).join('\n');
      return { text, isError: Boolean(r.isError), declined: [...s.call.declined], busy: [...s.call.busy] };
    } finally {
      s.call = null;
      s.lastUsed = Date.now();
    }
  });
  s.queue = run.catch(() => {});
  return run;
}

async function call(key, name, args, approve = []) {
  const s = servers.get(key);
  const out = await callOnce(key, name, args, approve, s?.helperMode ?? false);
  // The Codex app is closed or restarted (its pipe changed): the call never reached an app, so
  // start this caller's engine again on Codex's bundled helper and run it once more.
  if (out.isError && NO_PIPE.test(out.text) && !(servers.get(key)?.helperMode)) {
    stopServer(key, 'Codex app pipe unavailable');
    const again = await callOnce(key, name, args, approve, true);
    return { ...again, text: `[codex-cu] The Codex app was not reachable, so this engine restarted on Codex's bundled helper; JavaScript state from earlier calls is gone.\n${again.text}` };
  }
  return out;
}

// A tool result reaches Claude as text, so a screenshot is saved to a file it can open. Keeps the last 20.
function saveImage(block) {
  try {
    const dir = join(DATA, 'screenshots');
    mkdirSync(dir, { recursive: true });
    const ext = String(block.mimeType ?? 'image/png').split('/')[1] ?? 'png';
    const file = join(dir, `${Date.now()}-${randomBytes(3).toString('hex')}.${ext}`);
    writeFileSync(file, Buffer.from(block.data, 'base64'));
    const old = readdirSync(dir).sort();
    for (const name of old.slice(0, Math.max(0, old.length - 20))) rmSync(join(dir, name), { force: true });
    return `[screenshot saved: ${file} (open it with the Read tool to look at it)]`;
  } catch (error) {
    return `[screenshot could not be saved: ${error}]`;
  }
}

function sessionsJson() {
  return JSON.stringify(
    [...servers].map(([key, s]) => ({
      session: key,
      busy: Boolean(s.call),
      apps: [...s.apps],
      leases: [...leases].filter(([, holder]) => holder === key).map(([app]) => app),
      idleSeconds: Math.round((Date.now() - s.lastUsed) / 1000),
    })),
  );
}

function shutdown() {
  for (const key of [...servers.keys()]) stopServer(key, 'daemon exit');
  try {
    if (JSON.parse(readFileSync(STATE, 'utf8')).token === TOKEN) rmSync(STATE);
  } catch {}
  process.exit(0);
}

setInterval(() => {
  for (const [key, s] of servers) if (!s.call && Date.now() - s.lastUsed > SERVER_IDLE_MS) stopServer(key, 'idle');
}, 60 * 1000).unref();

const server = http.createServer((req, res) => {
  if (req.headers['x-codex-cu-token'] !== TOKEN) return res.writeHead(403).end('forbidden');
  let body = '';
  req.on('data', d => (body += d));
  req.on('end', async () => {
    try {
      if (req.url === '/health') return res.end(`ok ${VERSION}`);
      if (req.url === '/sessions') return res.writeHead(200, { 'content-type': 'application/json' }).end(sessionsJson());
      if (req.url === '/quit') {
        res.end('bye');
        return setTimeout(shutdown, 50);
      }
      touch();
      const { approve = [], session, ...args } = body ? JSON.parse(body) : {};
      const key = keyOf(session);
      if (req.url === '/end') {
        const ended = [...servers.keys()].filter(k => k === key || k.startsWith(`${key}/`));
        for (const k of ended) stopServer(k, 'session ended');
        return res.end(JSON.stringify({ ended }));
      }
      let out;
      if (req.url === '/reset') {
        out = await call(key, 'js_reset', {});
        releaseLeases(key);
      } else {
        out = await call(key, 'js', args, approve);
      }
      res
        .writeHead(out.isError ? 422 : 200, { 'x-codex-declined': JSON.stringify(out.declined), 'x-codex-busy': JSON.stringify(out.busy) })
        .end(out.text);
    } catch (error) {
      res.writeHead(500).end(String(error));
    }
  });
});
server.listen(0, '127.0.0.1', () => {
  const { port } = server.address();
  writeFileSync(STATE, JSON.stringify({ port, token: TOKEN, version: VERSION, pid: process.pid }), { mode: 0o600 });
  touch();
  log('daemon', VERSION, 'listening on 127.0.0.1:' + port);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, shutdown);
