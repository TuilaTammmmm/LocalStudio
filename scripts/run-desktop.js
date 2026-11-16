import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

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
  cmd = 'concurrently "tsx watch src/index.ts" "tauri dev"';
} else if (args[0] === 'build') {
  cmd = 'tauri build';
} else if (args[0] === 'start' || args[0] === 'app') {
  cmd = 'concurrently "node dist/index.js" "src-tauri\\target\\release\\local-ai-studio.exe"';
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
