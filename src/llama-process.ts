import { spawn, type ChildProcess } from 'node:child_process';
import type { LlamaServerConfig } from './types.js';

export interface ProcessStatus {
  isRunning: boolean;
  pid?: number;
  port: number;
  modelPath?: string;
  loadedLayers?: { gpu: number; total: number };
  recentLogs: string[];
}

export class LlamaProcessManager {
  private childProcess: ChildProcess | null = null;
  private currentConfig: LlamaServerConfig | null = null;
  private recentLogs: string[] = [];
  private maxLogLines = 100;
  private loadedLayers: { gpu: number; total: number } = { gpu: 0, total: 0 };

  /**
   * Spawn llama-server background process with configured CUDA + CPU flags
   */
  public async startServer(config: LlamaServerConfig): Promise<boolean> {
    if (this.childProcess) {
      await this.stopServer();
    }

    this.currentConfig = config;
    this.recentLogs = [];
    this.loadedLayers = { gpu: 0, total: 0 };

    const args: string[] = [
      '-m', config.modelPath,
      '--port', config.port.toString(),
      '--host', config.host,
      '-ngl', config.ngl.toString(),
      '-c', config.ctxSize.toString(),
      '-t', config.threads.toString(),
    ];

    if (config.flashAttention) {
      args.push('-fa');
    }

    if (config.kvCacheQuant && config.kvCacheQuant !== 'f16') {
      args.push('-ctk', config.kvCacheQuant, '-ctv', config.kvCacheQuant);
    }

    this.appendLog(`[Manager] Spawning: ${config.binaryPath} ${args.join(' ')}`);

    try {
      this.childProcess = spawn(config.binaryPath, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.childProcess.stdout?.on('data', (data) => {
        this.handleLogData(data.toString());
      });

      this.childProcess.stderr?.on('data', (data) => {
        this.handleLogData(data.toString());
      });

      this.childProcess.on('exit', (code, signal) => {
        this.appendLog(`[Manager] Process exited with code: ${code}, signal: ${signal}`);
        this.childProcess = null;
      });

      this.childProcess.on('error', (err) => {
        this.appendLog(`[Manager] Spawn error: ${err.message}`);
        this.childProcess = null;
      });

      // Poll /health endpoint for up to 30 seconds
      return await this.waitForReady(config.host, config.port, 30000);
    } catch (err: any) {
      this.appendLog(`[Manager] Failed to launch server: ${err.message}`);
      return false;
    }
  }

  /**
   * Graceful termination
   */
  public async stopServer(): Promise<void> {
    if (!this.childProcess) return;

    this.appendLog('[Manager] Stopping llama-server...');
    try {
      if (process.platform === 'win32' && this.childProcess.pid) {
        // Kill tree on Windows
        spawn('taskkill', ['/pid', this.childProcess.pid.toString(), '/f', '/t']);
      } else {
        this.childProcess.kill('SIGTERM');
      }
    } catch (err: any) {
      this.appendLog(`[Manager] Error stopping process: ${err.message}`);
    }

    this.childProcess = null;
    this.currentConfig = null;
  }

  /**
   * Check if endpoint /health returns 200 OK
   */
  public async isHealthy(): Promise<boolean> {
    if (!this.currentConfig) return false;
    try {
      const res = await fetch(`http://${this.currentConfig.host}:${this.currentConfig.port}/health`, {
        signal: AbortSignal.timeout(1500),
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  public getStatus(): ProcessStatus {
    return {
      isRunning: this.childProcess !== null && !this.childProcess.killed,
      pid: this.childProcess?.pid,
      port: this.currentConfig?.port || 8080,
      modelPath: this.currentConfig?.modelPath,
      loadedLayers: this.loadedLayers,
      recentLogs: this.recentLogs.slice(-20),
    };
  }

  private handleLogData(text: string): void {
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      this.appendLog(trimmed);

      // Parse layer offload evidence from llama.cpp logs
      // e.g.: "llm_load_tensors: offloaded 21/33 layers to CUDA"
      const layerMatch = trimmed.match(/offloaded\s+(\d+)\/(\d+)\s+layers/i);
      if (layerMatch) {
        this.loadedLayers = {
          gpu: parseInt(layerMatch[1], 10),
          total: parseInt(layerMatch[2], 10),
        };
      }
    }
  }

  private appendLog(line: string): void {
    this.recentLogs.push(`[${new Date().toLocaleTimeString()}] ${line}`);
    if (this.recentLogs.length > this.maxLogLines) {
      this.recentLogs.shift();
    }
  }

  private async waitForReady(host: string, port: number, timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (!this.childProcess) return false;
      try {
        const res = await fetch(`http://${host}:${port}/health`, {
          signal: AbortSignal.timeout(1000),
        });
        if (res.status === 200) {
          this.appendLog('[Manager] llama-server is READY and serving requests!');
          return true;
        }
      } catch {
        // Still initializing
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    return false;
  }
}
