import path from 'node:path';
import fs from 'node:fs';
import { DatabaseService } from '../src/db.js';
import { McpManager, type McpServerDefinition } from '../src/mcp-manager.js';

console.log('Testing McpManager (Model Context Protocol)...');

const tempDir = path.resolve(process.cwd(), '.temp_mcp_test');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

try {
  const db = new DatabaseService(tempDir);
  const mcp = new McpManager(db);

  // 1. Initial state
  const initialServers = mcp.getServers();
  console.log(`[MCP] Initial servers count: ${initialServers.length}`);
  if (!Array.isArray(initialServers)) throw new Error('Expected array of servers');

  // 2. Add an MCP server
  const testServer: McpServerDefinition = {
    id: 'server-filesystem',
    name: 'Local Filesystem MCP Server',
    command: 'node',
    args: ['-e', 'console.log("mock mcp")'],
    enabled: true,
    discoveredTools: [
      {
        name: 'read_file',
        description: 'Read file contents',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
        serverId: 'server-filesystem',
      },
    ],
  };

  mcp.saveServer(testServer);
  const serversAfterAdd = mcp.getServers();
  console.log(`[MCP] Servers after adding: ${serversAfterAdd.length}`);
  if (serversAfterAdd.length !== 1 || serversAfterAdd[0].name !== 'Local Filesystem MCP Server') {
    throw new Error('MCP server persistence failed');
  }

  // 3. Test tool discovery
  const tools = mcp.getAllDiscoveredTools();
  console.log(`[MCP] Discovered tools count: ${tools.length}`);
  if (tools.length !== 1 || tools[0].name !== 'read_file') {
    throw new Error('Tool discovery aggregation failed');
  }

  // 4. Test delete server
  mcp.deleteServer('server-filesystem');
  const remaining = mcp.getServers();
  if (remaining.length !== 0) throw new Error('MCP server deletion failed');

  db.close();
  console.log('✅ Phase 5 Model Context Protocol (MCP) verification PASSED!');
} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}
