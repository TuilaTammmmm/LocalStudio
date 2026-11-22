import { spawn, type ChildProcess } from 'node:child_process';
import type { DatabaseService } from './db.js';

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
  serverId: string;
}

export interface McpServerDefinition {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  status?: 'connected' | 'disconnected' | 'error';
  errorMessage?: string;
  discoveredTools?: McpToolDefinition[];
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

export class McpProcessClient {
  private child: ChildProcess | null = null;
  private messageId = 1;
  private pendingRequests = new Map<number | string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private buffer = '';

  constructor(public config: McpServerDefinition) {}

  public async connect(timeoutMs = 10000): Promise<McpToolDefinition[]> {
    return new Promise((resolve, reject) => {
      try {
        const env = { ...process.env, ...(this.config.env || {}) };
        this.child = spawn(this.config.command, this.config.args, {
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });

        const timer = setTimeout(() => {
          this.disconnect();
          reject(new Error(`Hết thời gian chờ kết nối MCP Server ${this.config.name} (${timeoutMs}ms)`));
        }, timeoutMs);

        this.child.stdout?.on('data', (data: Buffer) => {
          this.handleStdout(data.toString('utf-8'));
        });

        this.child.stderr?.on('data', (data: Buffer) => {
          // Log server stderr without breaking protocol
        });

        this.child.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });

        this.child.on('exit', () => {
          this.child = null;
        });

        // Initialize handshake according to MCP Specification
        this.sendRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          clientInfo: { name: 'LocalAI-Studio-Client', version: '1.0.5' },
        })
          .then(async () => {
            this.sendNotification('notifications/initialized', {});
            const toolsRes = await this.sendRequest('tools/list', {});
            clearTimeout(timer);
            const tools: McpToolDefinition[] = (toolsRes?.tools || []).map((t: any) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
              serverId: this.config.id,
            }));
            this.config.discoveredTools = tools;
            this.config.status = 'connected';
            resolve(tools);
          })
          .catch((err) => {
            clearTimeout(timer);
            this.config.status = 'error';
            this.config.errorMessage = err.message;
            reject(err);
          });
      } catch (err: any) {
        this.config.status = 'error';
        this.config.errorMessage = err.message;
        reject(err);
      }
    });
  }

  public async callTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
    if (!this.child) {
      throw new Error(`MCP Server ${this.config.name} chưa được kết nối`);
    }
    return this.sendRequest('tools/call', {
      name: toolName,
      arguments: args,
    });
  }

  public disconnect(): void {
    if (this.child) {
      try {
        this.child.kill('SIGTERM');
      } catch {}
      this.child = null;
    }
    this.config.status = 'disconnected';
  }

  private sendRequest(method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.child || !this.child.stdin) {
        return reject(new Error('Process stdin không khả dụng'));
      }
      const id = this.messageId++;
      this.pendingRequests.set(id, { resolve, reject });

      const payload: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.child.stdin.write(JSON.stringify(payload) + '\n');
    });
  }

  private sendNotification(method: string, params?: any): void {
    if (!this.child || !this.child.stdin) return;
    const payload = {
      jsonrpc: '2.0',
      method,
      params,
    };
    this.child.stdin.write(JSON.stringify(payload) + '\n');
  }

  private handleStdout(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg: JsonRpcResponse = JSON.parse(trimmed);
        if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
          const { resolve, reject } = this.pendingRequests.get(msg.id)!;
          this.pendingRequests.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message || 'Lỗi xử lý MCP'));
          } else {
            resolve(msg.result);
          }
        }
      } catch {}
    }
  }
}

export class McpManager {
  private activeClients = new Map<string, McpProcessClient>();

  constructor(private db: DatabaseService) {}

  public getServers(): McpServerDefinition[] {
    return this.db.getKV<McpServerDefinition[]>('mcp_servers') || [];
  }

  public saveServer(server: McpServerDefinition): McpServerDefinition[] {
    const servers = this.getServers().filter((s) => s.id !== server.id);
    servers.push(server);
    this.db.setKV('mcp_servers', servers);
    return servers;
  }

  public deleteServer(serverId: string): McpServerDefinition[] {
    this.disconnectServer(serverId);
    const servers = this.getServers().filter((s) => s.id !== serverId);
    this.db.setKV('mcp_servers', servers);
    return servers;
  }

  public async connectServer(serverId: string): Promise<McpToolDefinition[]> {
    const server = this.getServers().find((s) => s.id === serverId);
    if (!server) throw new Error(`Không tìm thấy MCP Server ID: ${serverId}`);

    this.disconnectServer(serverId);
    const client = new McpProcessClient(server);
    this.activeClients.set(serverId, client);

    const tools = await client.connect();
    this.saveServer(server);
    return tools;
  }

  public disconnectServer(serverId: string): void {
    const client = this.activeClients.get(serverId);
    if (client) {
      client.disconnect();
      this.activeClients.delete(serverId);
    }
  }

  public getAllDiscoveredTools(): McpToolDefinition[] {
    const tools: McpToolDefinition[] = [];
    for (const server of this.getServers()) {
      if (server.enabled && server.discoveredTools) {
        tools.push(...server.discoveredTools);
      }
    }
    return tools;
  }

  public async callTool(serverId: string, toolName: string, args: Record<string, any>): Promise<any> {
    let client = this.activeClients.get(serverId);
    if (!client) {
      await this.connectServer(serverId);
      client = this.activeClients.get(serverId);
    }
    if (!client) throw new Error(`Không thể khởi tạo client cho server: ${serverId}`);
    return client.callTool(toolName, args);
  }
}
