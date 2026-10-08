// Launches Codex's computer-use MCP server for the codex-cu daemon, found fresh on every start
// so a Codex update (new runtime folder, new plugin version, new pipe name) never breaks it.
//
// Windows: the node_repl server Codex itself registers in ~/.codex/config.toml
//   ([mcp_servers.node_repl] and its .env), which Codex rewrites on each launch. If that entry is
//   missing or stale, falls back to the newest runtimes/cua_node/<hash>/bin/node_repl.exe with the
//   env of the newest unified-computer-use plugin's .mcp.json.
// macOS: cua_repl from the newest unified-computer-use plugin's .mcp.json.
//
// CODEX_CU_HELPER_MODE=1 drops the native pipe to the Codex app, so @oai/sky starts its own
// bundled helper instead (used when the Codex app is not running).
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const home = homedir();
const codexHome = process.env.CODEX_HOME || join(home, '.codex');
const fail = message => {
  process.stderr.write(`codex-cu: ${message}\n`);
  process.exit(1);
};

const cmpVersion = (a, b) => {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
};

// The newest unified-computer-use plugin's cua_repl entry, or null.
function newestPluginServer() {
  const root = join(codexHome, 'plugins/cache/openai-bundled/unified-computer-use');
  if (!existsSync(root)) return null;
  const versions = readdirSync(root).filter(v => existsSync(join(root, v, '.mcp.json'))).sort(cmpVersion);
  if (versions.length === 0) return null;
  return JSON.parse(readFileSync(join(root, versions.at(-1), '.mcp.json'), 'utf8')).mcpServers?.cua_repl ?? null;
}

// One TOML table's flat `key = value` lines (strings, literal strings, arrays of strings).
function tomlTable(text, name) {
  const header = new RegExp(`^\\[${name.replace(/\./g, '\\.')}\\]\\s*$`, 'm').exec(text);
  if (!header) return null;
  const table = {};
  for (const line of text.slice(header.index + header[0].length).split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) break;
    const kv = /^\s*([A-Za-z0-9_-]+)\s*=\s*(.+?)\s*$/.exec(line);
    if (!kv) continue;
    const raw = kv[2];
    try {
      table[kv[1]] = raw.startsWith("'") ? raw.slice(1, raw.lastIndexOf("'")) : JSON.parse(raw);
    } catch {
      table[kv[1]] = raw;
    }
  }
  return table;
}

function windowsServer() {
  let command, args = [], env = {};
  try {
    const toml = readFileSync(join(codexHome, 'config.toml'), 'utf8');
    const server = tomlTable(toml, 'mcp_servers.node_repl');
    if (server?.command && existsSync(server.command)) {
      command = server.command;
      args = Array.isArray(server.args) ? server.args : [];
      env = tomlTable(toml, 'mcp_servers.node_repl.env') ?? {};
    }
  } catch {
    // no config.toml: fall back below
  }
  if (!command) {
    const runtimes = join(process.env.LOCALAPPDATA || join(home, 'AppData/Local'), 'OpenAI/Codex/runtimes/cua_node');
    const newest = existsSync(runtimes)
      ? readdirSync(runtimes)
          .map(name => join(runtimes, name, 'bin'))
          .filter(bin => existsSync(join(bin, 'node_repl.exe')))
          .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs)
          .at(-1)
      : undefined;
    if (!newest) fail(`no Codex computer-use runtime found in ${runtimes}. Install the Codex app and turn on Computer Use once.`);
    command = join(newest, 'node_repl.exe');
    const pluginEnv = newestPluginServer()?.env ?? {};
    env = {
      ...pluginEnv,
      NODE_REPL_NODE_PATH: join(newest, 'node.exe'),
      NODE_REPL_NODE_MODULE_DIRS: join(newest, 'node_modules'),
      NODE_REPL_TRUSTED_CODE_PATHS: `${codexHome};${join(newest, 'node_modules')}`,
      CODEX_HOME: codexHome,
    };
    // the plugin entry is scoped to the browser; this bridge drives desktop apps
    delete env.CUA_REPL_ENABLED_SURFACES;
  }
  if (process.env.CODEX_CU_HELPER_MODE === '1') {
    delete env.SKY_CUA_NATIVE_PIPE;
    delete env.SKY_CUA_NATIVE_PIPE_DIRECTORY;
  }
  return { command, args, env };
}

function macServer() {
  const cfg = newestPluginServer();
  if (!cfg) fail('no unified-computer-use plugin found under ~/.codex/plugins/cache. Open the ChatGPT/Codex app once.');
  return { command: cfg.command, args: cfg.args || [], env: cfg.env || {} };
}

const cfg = process.platform === 'win32' ? windowsServer() : macServer();
// node_repl's sandboxed kernel needs a working directory its sandbox user can open: the home folder.
const child = spawn(cfg.command, cfg.args, {
  cwd: home,
  stdio: 'inherit',
  windowsHide: true,
  env: { ...process.env, ...cfg.env },
});
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => child.kill());
child.on('exit', (code, sig) => process.exit(sig ? 1 : code ?? 0));
