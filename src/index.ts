import { serve } from '@hono/node-server';
import { DatabaseService } from './db.js';
import { LlamaProcessManager } from './llama-process.js';
import { MultiProviderRouter } from './router.js';
import { createServer } from './server.js';

export const DEFAULT_PORT = parseInt(process.env.PORT || '3001', 10);

export function startBackend(port: number = DEFAULT_PORT) {
  const db = new DatabaseService();
  const llamaManager = new LlamaProcessManager();
  const router = new MultiProviderRouter(db, llamaManager);
  const app = createServer(db, llamaManager, router);

  console.log(`=================================================`);
  console.log(`🚀 Local AI Backend Core starting on port ${port}...`);
  console.log(`• Inference Engines: Local llama.cpp (CUDA) & FreeLLM API`);
  console.log(`• Workspace & Skills Server ready.`);
  console.log(`=================================================`);

  const server = serve({
    fetch: app.fetch,
    port,
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n⚠️ Port ${port} is already in use by another instance.`);
      if (!process.versions.electron) {
        process.exit(1);
      }
    } else {
      console.error('Server error:', err);
      if (!process.versions.electron) {
        process.exit(1);
      }
    }
  });

  const cleanup = async () => {
    console.log('\nShutting down Local AI Backend Core...');
    await llamaManager.stopServer();
    try {
      db.close();
    } catch {}
    server.close();
  };

  return { server, llamaManager, db, router, app, cleanup };
}

// Auto-run if executed directly via node or tsx (and NOT inside Electron main process)
const isDirectRun =
  !process.versions.electron &&
  process.argv[1] &&
  (process.argv[1].endsWith('index.ts') ||
   process.argv[1].endsWith('index.js') ||
   process.argv[1].includes('tsx'));

if (isDirectRun) {
  const { cleanup } = startBackend(DEFAULT_PORT);
  process.on('SIGINT', async () => {
    await cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await cleanup();
    process.exit(0);
  });
}

