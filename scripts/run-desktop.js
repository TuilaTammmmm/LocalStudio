import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

// Helper to kill any orphan process holding a port before starting
function freePort(port) {
  try {
    if (process.platform === 'win32') {
      const stdout = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        if (!line.includes('LISTENING')) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && !isNaN(Number(pid))) {
          try {
            execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
          } catch {}
        }
      }
    }
  } catch {}
}

// Ensure ~/.cargo/bin and node_modules/.bin are always in PATH even if the terminal session hasn't reloaded environment
const cargoBin = path.join(os.homedir(), '.cargo', 'bin');
const nodeBin = path.join(process.cwd(), 'node_modules', '.bin');
const env = { ...process.env };

const pathParts = [cargoBin, nodeBin];
if (env.PATH) {
  pathParts.push(env.PATH);
}
env.PATH = pathParts.join(path.delimiter);

const args = process.argv.slice(2);
let cmd = '';

if (args.length === 0 || args[0] === 'dev') {
  freePort(3001);
  cmd = 'concurrently "tsx watch src/index.ts" "tauri dev"';
} else if (args[0] === 'build') {
  cmd = 'tauri build --no-bundle';
} else if (args[0] === 'start' || args[0] === 'app') {
  freePort(3001);
  cmd = 'src-tauri\\target\\release\\local-ai-studio.exe';
} else {
  cmd = `tauri ${args.join(' ')}`;
}

const child = spawn(cmd, {
  stdio: 'inherit',
  env,
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
