import { DatabaseService } from '../src/db.js';
import path from 'node:path';
import fs from 'node:fs';

const testDir = path.resolve(process.cwd(), '.data_test');
if (fs.existsSync(testDir)) {
  fs.rmSync(testDir, { recursive: true, force: true });
}

console.log('Testing DatabaseService...');
const db = new DatabaseService(testDir);

// 1. Test providers
const providers = db.listProviders();
console.log(`Found ${providers.length} default providers.`);
if (providers.length < 2) {
  throw new Error('Default providers not initialized');
}

// 2. Test workspace
const ws = db.saveWorkspace({
  id: 'ws-1',
  name: 'Project LocalAI',
  folderPath: 'c:\\Tam\\Code\\LocalAI',
  pinnedFiles: ['package.json'],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
console.log(`Created workspace: ${ws.name}`);

// 3. Test chat session
const session = db.saveSession({
  id: 'sess-1',
  workspaceId: ws.id,
  title: 'Backend Setup Discussion',
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
console.log(`Created session: ${session.title}`);

// 4. Test chat message
const msg = db.addMessage({
  id: 'msg-1',
  sessionId: session.id,
  role: 'user',
  content: 'Hello LocalAI',
  createdAt: Date.now(),
});
console.log(`Added message: ${msg.content}`);

const messages = db.getMessages(session.id);
if (messages.length !== 1 || messages[0].content !== 'Hello LocalAI') {
  throw new Error('Message persistence failed');
}

// Clean up
db.close();
fs.rmSync(testDir, { recursive: true, force: true });
console.log('✅ Phase 1 Database verification PASSED!');
