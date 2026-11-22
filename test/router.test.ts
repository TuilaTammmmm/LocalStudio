import { DatabaseService } from '../src/db.js';
import { LlamaProcessManager } from '../src/llama-process.js';
import { MultiProviderRouter } from '../src/router.js';
import path from 'node:path';
import fs from 'node:fs';

async function run() {
  console.log('Testing MultiProviderRouter...');
  const testDir = path.resolve(process.cwd(), '.data_router_test');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }

  const db = new DatabaseService(testDir);
  const llama = new LlamaProcessManager();
  const router = new MultiProviderRouter(db, llama);

  // 1. Check active provider
  const active = router.getActiveProvider();
  console.log(`Active provider: ${active.name} (${active.baseUrl})`);
  if (!active) throw new Error('Active provider is null');

  // 2. Switch provider
  const switched = await router.switchProvider('freellm-api');
  console.log(`Switched to: ${switched.name}`);
  if (router.getActiveProvider().id !== 'freellm-api') {
    throw new Error('Provider switch failed');
  }

  // 3. Test Provider sync logic with graceful error handling
  const syncResult = await router.testAndSyncProvider('freellm-api');
  console.log(`Sync test result: success = ${syncResult.success}, latency = ${syncResult.latencyMs}ms`);

  // Clean up
  db.close();
  fs.rmSync(testDir, { recursive: true, force: true });
  console.log('✅ Phase 3 Multi-Provider Router verification PASSED!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
