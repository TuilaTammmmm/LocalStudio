import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

export interface TokenizeResult {
  tokens: number[];
  count: number;
  engine: 'rust' | 'llama-server' | 'heuristic';
}

export interface RustRagResult {
  filePath: string;
  relativePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
  score: number;
}

export class RustTokenizerService {
  private static process: ChildProcess | null = null;
  private static currentLoadedPath = '';
  private static pendingRequests: Map<number, (res: any) => void> = new Map();
  private static requestId = 0;
  private static binaryPath: string | null = null;
  private static initPromise: Promise<boolean> | null = null;

  /**
   * Locate the compiled rust-tokenizer binary
   */
  public static findBinaryPath(): string | null {
    if (this.binaryPath && fs.existsSync(this.binaryPath)) {
      return this.binaryPath;
    }

    const candidatePaths = [
      ...((process as any).resourcesPath ? [path.join((process as any).resourcesPath, 'bin', 'rust-tokenizer.exe')] : []),
      path.join(process.cwd(), 'bin', 'rust-tokenizer.exe'),
      path.join(process.cwd(), 'rust-tokenizer', 'target', 'release', 'rust-tokenizer.exe'),
      path.join(process.cwd(), 'rust-tokenizer', 'target', 'debug', 'rust-tokenizer.exe'),
      path.join(process.cwd(), 'dist-electron', 'bin', 'rust-tokenizer.exe'),
      path.join(os.homedir(), 'LocalAI', 'bin', 'rust-tokenizer.exe'),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        this.binaryPath = p;
        return p;
      }
    }
    return null;
  }

  /**
   * Start or verify the long-running Rust daemon process
   */
  public static async ensureProcess(): Promise<boolean> {
    if (this.process && !this.process.killed) {
      return true;
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      const bin = this.findBinaryPath();
      if (!bin) {
        console.warn('[RustTokenizer] rust-tokenizer binary not found. Will use llama-server /tokenize fallback.');
        return false;
      }

      try {
        const proc = spawn(bin, [], {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });
        proc.unref();

        proc.stdout?.on('data', (chunk: Buffer) => {
          const lines = chunk.toString('utf-8').split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const data = JSON.parse(trimmed);
              // Resolve next pending request
              const nextId = this.pendingRequests.keys().next().value;
              if (nextId !== undefined) {
                const resolver = this.pendingRequests.get(nextId);
                this.pendingRequests.delete(nextId);
                if (resolver) resolver(data);
              }
            } catch {}
          }
        });

        proc.on('error', (err) => {
          console.warn('[RustTokenizer] Daemon error:', err.message);
          this.process = null;
        });

        proc.on('exit', () => {
          this.process = null;
          this.currentLoadedPath = '';
        });

        this.process = proc;
        return true;
      } catch (err: any) {
        console.warn('[RustTokenizer] Failed to spawn rust-tokenizer:', err.message);
        return false;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Terminate and clean up the Rust daemon process
   */
  public static dispose(): void {
    if (this.process && !this.process.killed) {
      try {
        this.process.kill();
      } catch {}
      this.process = null;
      this.currentLoadedPath = '';
      this.pendingRequests.clear();
    }
  }

  /**
   * Find tokenizer.json file corresponding to a model on disk
   */
  public static findTokenizerPath(modelNameOrFilename: string, modelsDir?: string): string | null {
    const searchDirs = [
      modelsDir,
      path.join(process.env.USERPROFILE || process.env.HOME || os.homedir() || 'C:\\', 'LocalAI', 'models'),
      path.join(process.cwd(), 'models'),
    ].filter(Boolean) as string[];

    const cleanName = path.basename(modelNameOrFilename).replace(/\.gguf$/i, '');

    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;

      const candidates = [
        path.join(dir, `${cleanName}.tokenizer.json`),
        path.join(dir, `${cleanName}`, 'tokenizer.json'),
        path.join(dir, 'tokenizer.json'),
      ];

      for (const c of candidates) {
        if (fs.existsSync(c)) {
          return c;
        }
      }

      // Check loose tokenizer.json files matching model prefix
      try {
        const files = fs.readdirSync(dir);
        const match = files.find(
          (f) =>
            f.toLowerCase().endsWith('.tokenizer.json') &&
            (f.toLowerCase().includes(cleanName.toLowerCase().split('-')[0]) ||
             cleanName.toLowerCase().includes(f.toLowerCase().replace('.tokenizer.json', '')))
        );
        if (match) {
          return path.join(dir, match);
        }
      } catch {}
    }
    return null;
  }

  /**
   * Load a tokenizer.json into the Rust daemon
   */
  public static async loadTokenizer(tokenizerPath: string): Promise<boolean> {
    if (!fs.existsSync(tokenizerPath)) return false;
    if (this.currentLoadedPath === tokenizerPath) return true;

    const ready = await this.ensureProcess();
    if (!ready || !this.process?.stdin) return false;

    return new Promise((resolve) => {
      const id = ++this.requestId;
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        resolve(false);
      }, 3000);

      this.pendingRequests.set(id, (res) => {
        clearTimeout(timer);
        if (res && res.success) {
          this.currentLoadedPath = tokenizerPath;
          console.log(`[RustTokenizer] Loaded tokenizer: ${path.basename(tokenizerPath)} (Vocab: ${res.vocab_size})`);
          resolve(true);
        } else {
          resolve(false);
        }
      });

      this.process!.stdin!.write(JSON.stringify({ action: 'load', path: tokenizerPath }) + '\n');
    });
  }

  /**
   * Tokenize text using Rust Tokenizer, with llama-server /tokenize fallback
   */
  public static async tokenize(
    text: string,
    options: {
      modelName?: string;
      tokenizerPath?: string;
      modelsDir?: string;
      llamaServerUrl?: string;
    } = {}
  ): Promise<TokenizeResult> {
    if (!text) {
      return { tokens: [], count: 0, engine: 'rust' };
    }

    // 1. Resolve tokenizer path
    let tokenizerPath = options.tokenizerPath;
    if (!tokenizerPath && options.modelName) {
      tokenizerPath = this.findTokenizerPath(options.modelName, options.modelsDir) || undefined;
    }

    // 2. Try Rust Tokenizer if tokenizer.json exists
    if (tokenizerPath && fs.existsSync(tokenizerPath)) {
      const isLoaded = await this.loadTokenizer(tokenizerPath);
      if (isLoaded && this.process?.stdin) {
        try {
          const res = await new Promise<any>((resolve) => {
            const id = ++this.requestId;
            const timer = setTimeout(() => {
              this.pendingRequests.delete(id);
              resolve(null);
            }, 3000);

            this.pendingRequests.set(id, (data) => {
              clearTimeout(timer);
              resolve(data);
            });

            this.process!.stdin!.write(JSON.stringify({ action: 'encode', text }) + '\n');
          });

          if (res && res.success && Array.isArray(res.tokens)) {
            return {
              tokens: res.tokens,
              count: res.count ?? res.tokens.length,
              engine: 'rust',
            };
          }
        } catch {}
      }
    }

    // 3. Fallback: Query llama-server built-in /tokenize endpoint (reads directly from GGUF metadata)
    const serverUrl = options.llamaServerUrl || 'http://127.0.0.1:8080';
    try {
      const res = await fetch(`${serverUrl}/tokenize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, with_special: true }),
        signal: AbortSignal.timeout(1500),
      });

      if (res.ok) {
        const data: any = await res.json();
        if (Array.isArray(data.tokens)) {
          return {
            tokens: data.tokens,
            count: data.tokens.length,
            engine: 'llama-server',
          };
        }
      }
    } catch {}

    // 4. Fallback heuristic
    return {
      tokens: [],
      count: Math.ceil(text.length / 3.0),
      engine: 'heuristic',
    };
  }

  /**
   * High-performance multi-threaded RAG search via Rust Engine
   */
  public static async searchRAG(
    rootPath: string,
    query: string,
    limit = 8
  ): Promise<{ results: RustRagResult[]; engine: 'rust' | 'ts' }> {
    if (!rootPath || !query.trim()) {
      return { results: [], engine: 'rust' };
    }

    const ready = await this.ensureProcess();
    if (ready && this.process?.stdin) {
      try {
        const res = await new Promise<any>((resolve) => {
          const id = ++this.requestId;
          const timer = setTimeout(() => {
            this.pendingRequests.delete(id);
            resolve(null);
          }, 4000);

          this.pendingRequests.set(id, (data) => {
            clearTimeout(timer);
            resolve(data);
          });

          this.process!.stdin!.write(
            JSON.stringify({
              action: 'rag_search',
              root_path: rootPath,
              query,
              limit,
            }) + '\n'
          );
        });

        if (res && res.success && Array.isArray(res.rag_results)) {
          return {
            results: res.rag_results,
            engine: 'rust',
          };
        }
      } catch (err) {
        console.warn('[RustTokenizer] Rust RAG search error:', err);
      }
    }

    return { results: [], engine: 'ts' };
  }
}
