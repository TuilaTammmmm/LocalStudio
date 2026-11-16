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

  // Clean up
  fs.rmSync(testDir, { recursive: true, force: true });
  console.log('✅ Phase 6 REST API Integration verification PASSED!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
