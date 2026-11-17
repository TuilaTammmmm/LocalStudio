import { DatabaseService } from '../src/db.js';
import { LlamaProcessManager } from '../src/llama-process.js';
import { MultiProviderRouter } from '../src/router.js';
import { createServer } from '../src/server.js';
import path from 'node:path';
import fs from 'node:fs';

async function run() {
  console.log('Testing Hono API Server endpoints...');
  const testDir = path.resolve(process.cwd(), '.data_api_test');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }

  const db = new DatabaseService(testDir);
  const llama = new LlamaProcessManager();
  const router = new MultiProviderRouter(db, llama);
  const app = createServer(db, llama, router);

  // 1. Test /api/hardware
  const hwRes = await app.request('/api/hardware');
  if (hwRes.status !== 200) throw new Error(`Expected 200 from /api/hardware, got ${hwRes.status}`);
  const hwData: any = await hwRes.json();
  console.log(`[GET /api/hardware] GPU: ${hwData.stats.gpuName}, 8B Rec: -ngl ${hwData.recommendations['8B'].ngl}`);

  // 2. Test /api/providers
  const provRes = await app.request('/api/providers');
  if (provRes.status !== 200) throw new Error(`Expected 200 from /api/providers, got ${provRes.status}`);
  const provData: any = await provRes.json();
  console.log(`[GET /api/providers] Providers count: ${provData.providers.length}, Active: ${provData.activeProvider.name}`);

  // 3. Test /api/workspaces POST & GET
  const createWsRes = await app.request('/api/workspaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Project Frontend Test',
      folderPath: process.cwd(),
    }),
  });
  if (createWsRes.status !== 200) throw new Error('Failed to create workspace');
  const createdWs: any = await createWsRes.json();
  console.log(`[POST /api/workspaces] Created: ${createdWs.name} (${createdWs.id})`);

  // 4. Test /api/workspaces/:id/tree
  const treeRes = await app.request(`/api/workspaces/${createdWs.id}/tree`);
  if (treeRes.status !== 200) throw new Error('Failed to fetch tree');
  const treeData: any = await treeRes.json();
  console.log(`[GET /api/workspaces/:id/tree] Scanned files/folders: ${treeData.tree.length}`);

  // 5. Test /api/workspaces/:id/sessions POST & GET
  const createSessRes = await app.request(`/api/workspaces/${createdWs.id}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Auth Refactor Session' }),
  });
  const createdSess: any = await createSessRes.json();
  console.log(`[POST /api/workspaces/:id/sessions] Created chat session: ${createdSess.title}`);

  const sessListRes = await app.request(`/api/workspaces/${createdWs.id}/sessions`);
  const sessList: any = await sessListRes.json();
  if (sessList.length !== 1) throw new Error('Expected 1 session in workspace');
  console.log(`[GET /api/workspaces/:id/sessions] Retrieved ${sessList.length} session(s)`);

  // 6. Test Safe Workspace File Reading & Path Traversal Block
  const safeFileRes = await app.request(`/api/workspaces/${createdWs.id}/file?path=package.json`);
  if (safeFileRes.status !== 200) throw new Error('Failed to read legitimate workspace file');
  const safeFileData: any = await safeFileRes.json();
  if (!safeFileData.content.includes('local-ai-backend')) throw new Error('Invalid file content returned');

  const attackFileRes = await app.request(`/api/workspaces/${createdWs.id}/file?path=../../Windows/System32/drivers/etc/hosts`);
  if (attackFileRes.status !== 403) throw new Error(`Expected 403 for directory traversal, got ${attackFileRes.status}`);
  console.log('[Security] Workspace path traversal attempt blocked with 403 Forbidden.');

  // 7. Test Terminal Security Sandbox
  const safeCmdRes = await app.request('/api/terminal/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'Write-Output "Sandbox Test OK"' }),
  });
  if (safeCmdRes.status !== 200) throw new Error('Safe terminal command failed');
  const safeCmdData: any = await safeCmdRes.json();
  if (!safeCmdData.stdout.includes('Sandbox Test OK')) throw new Error('Terminal output mismatch');

  const dangerousCmdRes = await app.request('/api/terminal/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'rmdir /s /q C:\\' }),
  });
  if (dangerousCmdRes.status !== 403) throw new Error(`Expected 403 for dangerous command, got ${dangerousCmdRes.status}`);
  const dangerData: any = await dangerousCmdRes.json();
  if (!dangerData.blocked) throw new Error('Dangerous command was not flagged as blocked');
  console.log('[Security] Destructive command "rmdir /s /q C:\\" blocked by Sandbox.');

  // 8. Test Model Downloader & Cancel
  const downloadRes = await app.request('/api/models/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId: 'test-model', modelName: 'Test Model', fileSizeBytes: 1000000 }),
  });
  if (downloadRes.status !== 200) throw new Error('Failed to start download');
  const cancelRes = await app.request('/api/models/downloads/test-model/cancel', { method: 'POST' });
  const cancelData: any = await cancelRes.json();
  if (!cancelData.success) throw new Error('Failed to cancel download');
  console.log('[Downloader] Model download started and canceled successfully.');

  // Clean up
  fs.rmSync(testDir, { recursive: true, force: true });
  console.log('✅ Phase 6 REST API Integration verification PASSED!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
