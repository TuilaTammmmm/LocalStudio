import { serve } from '@hono/node-server';
import { DatabaseService } from './db.js';
import { LlamaProcessManager } from './llama-process.js';
import { MultiProviderRouter } from './router.js';
import { createServer } from './server.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

const db = new DatabaseService();
const llamaManager = new LlamaProcessManager();
const router = new MultiProviderRouter(db, llamaManager);
const app = createServer(db, llamaManager, router);

console.log(`=================================================`);
console.log(`🚀 Local AI Backend Core starting on port ${PORT}...`);
console.log(`• Inference Engines: Local llama.cpp (CUDA) & FreeLLM API`);
console.log(`• Workspace & Skills Server ready.`);
console.log(`=================================================`);

const server = serve({
  fetch: app.fetch,
  port: PORT,
});

const cleanup = async () => {
  console.log('\nShutting down Local AI Backend Core...');
  await llamaManager.stopServer();
  server.close();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
