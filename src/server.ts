import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import type { DatabaseService } from './db.js';
import type { LlamaProcessManager } from './llama-process.js';
import type { MultiProviderRouter } from './router.js';
import { HardwareMonitor } from './hardware.js';
import { WorkspaceFS } from './workspace-fs.js';
import { ContextBuilder } from './context-builder.js';
import { SkillsScanner } from './skills-scanner.js';
import { SkillsRunner } from './skills-runner.js';
import { AutoModelRouter, DEFAULT_AUTO_ROUTE_CONFIG } from './auto-router.js';
import { ModelHubService, CURATED_MODELS, type ModelHubItem, parseModelMetadata } from './model-hub.js';
import { ModelDownloaderService } from './model-downloader.js';
import { getSmartModelPreset } from './model-presets.js';
import { AppUpdater } from './updater.js';
import { SwarmEngine } from './swarm-engine.js';
import { RuntimeManager } from './runtime-manager.js';
import { McpManager } from './mcp-manager.js';
import { exec, spawn, execFile } from 'node:child_process';
import util from 'node:util';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const execAsync = util.promisify(exec);

export const DEFAULT_SYSTEM_PROMPT =
  `You are an elite, highly concise software engineering AI.
STRICT NEGATIVE CONSTRAINTS:
- Do NOT include greetings, pleasantries, or preamble (e.g., "Hello!", "Sure, I can help with that", "Here is the code").
- Do NOT repeat or paraphrase the user's prompt.
- Do NOT include conversational filler, meta-commentary, or sign-offs (e.g., "Hope this helps!", "Let me know if you need anything else").
- Output direct, production-ready code with minimal, essential explanations only.
- Use concise bullet points for explanations instead of lengthy paragraphs.`;

export function discoverWorkspaceRules(folderPath?: string): string | null {
  if (!folderPath || !fs.existsSync(folderPath)) return null;
  const candidateFiles = ['.localairules', '.cursorrules'];
  for (const filename of candidateFiles) {
    const fullPath = path.join(folderPath, filename);
    if (fs.existsSync(fullPath)) {
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isFile()) {
          const raw = fs.readFileSync(fullPath, 'utf-8');
          if (Buffer.byteLength(raw, 'utf-8') > 3500) {
            const buf = Buffer.from(raw, 'utf-8');
            return buf.subarray(0, 3500).toString('utf-8');
          }
          return raw;
        }
      } catch {}
    }
  }
  return null;
}

export function createServer(
  db: DatabaseService,
  llamaManager: LlamaProcessManager,
  router: MultiProviderRouter
) {
  const app = new Hono();
  const hwMonitor = new HardwareMonitor();
  const runtimeManager = new RuntimeManager();
  const mcpManager = new McpManager(db);
  const swarmEngine = new SwarmEngine({ router, db });

  app.use('/*', cors());

  // Engine Status, Manifest & On-demand Installer
  app.get('/api/engine/status', async (c) => {
    const status = await runtimeManager.getStatus();
    return c.json(status);
  });

  app.get('/api/engine/manifest', (c) => {
    return c.json({ runtimes: runtimeManager.getManifest() });
  });

  app.post('/api/engine/install', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await runtimeManager.downloadAndInstall(body.runtimeId);
    return c.json(result, result.success ? 200 : 500);
  });

  // Model Context Protocol (MCP) Endpoints
  app.get('/api/mcp/servers', (c) => {
    return c.json({
      servers: mcpManager.getServers(),
      tools: mcpManager.getAllDiscoveredTools(),
    });
  });

  app.post('/api/mcp/servers', async (c) => {
    const body = await c.req.json();
    if (!body.id || !body.name || !body.command) {
      return c.json({ error: 'id, name, and command are required' }, 400);
    }
    const server = {
      id: body.id,
      name: body.name,
      command: body.command,
      args: body.args || [],
      env: body.env || {},
      enabled: body.enabled !== false,
      status: 'disconnected' as const,
    };
    const updated = mcpManager.saveServer(server);
    return c.json({ servers: updated });
  });

  app.delete('/api/mcp/servers/:id', (c) => {
    const id = c.req.param('id');
    const updated = mcpManager.deleteServer(id);
    return c.json({ servers: updated });
  });

  app.post('/api/mcp/servers/:id/connect', async (c) => {
    const id = c.req.param('id');
    try {
      const tools = await mcpManager.connectServer(id);
      return c.json({ success: true, tools });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  app.post('/api/mcp/call', async (c) => {
    const body = await c.req.json();
    if (!body.serverId || !body.toolName) {
      return c.json({ error: 'serverId and toolName are required' }, 400);
    }
    try {
      const result = await mcpManager.callTool(body.serverId, body.toolName, body.arguments || {});
      return c.json({ success: true, result });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  // 1. Hardware Monitor & Smart Offload
  app.get('/api/hardware', async (c) => {
    const stats = await hwMonitor.getStats();
    const offload8B = hwMonitor.calculateSmartOffload(stats, '8B');
    const offload3B = hwMonitor.calculateSmartOffload(stats, '3B');
    const processStatus = llamaManager.getStatus();

    return c.json({
      stats,
      recommendations: {
        '8B': offload8B,
        '3B': offload3B,
      },
      llamaProcess: processStatus,
    });
  });

  // Manual & Auto Llama-server control
  app.post('/api/llama/start', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const binaryPath = llamaManager.findBinaryPath(body.binaryPath);
    if (!binaryPath) {
      return c.json({ error: 'llama-server binary not found' }, 404);
    }
    const localLlama = db.getProvider('local-llama');
    const modelPath = router.findModelPath(body.model || localLlama?.selectedModel);
    if (!modelPath) {
      return c.json({ error: 'Model file not found' }, 404);
    }
    const started = await llamaManager.startServer({
      binaryPath,
      modelPath,
      port: 8080,
      host: '127.0.0.1',
      ngl: body.gpuLayers ?? localLlama?.gpuLayers ?? 21,
      ctxSize: body.contextSize ?? localLlama?.contextSize ?? 4096,
      threads: body.cpuThreads ?? localLlama?.cpuThreads ?? 4,
      flashAttention: body.flashAttention ?? localLlama?.flashAttention ?? true,
    });
    return c.json({ success: started, status: llamaManager.getStatus() });
  });

  app.post('/api/llama/stop', async (c) => {
    await llamaManager.stopServer();
    return c.json({ success: true, status: llamaManager.getStatus() });
  });

  // 1.1 LM Studio-Style Model Hub & Compatibility
  app.get('/api/models/hub', async (c) => {
    const stats = await hwMonitor.getStats();
    const customModels = db.listCustomHubModels();
    const allModels = [...CURATED_MODELS, ...customModels];
    const modelsWithCompatibility = allModels.map((model) => {
      const evaluation = ModelHubService.evaluateCompatibility(
        model,
        stats.vramTotalMb || 4096,
        stats.vramFreeMb || 3600,
        undefined,
        stats.ramTotalMb,
        stats.ramFreeMb
      );
      return {
        ...model,
        compatibility: evaluation,
      };
    });

    return c.json({
      hardware: {
        gpu: stats.gpuName,
        vramTotalMb: stats.vramTotalMb,
        vramFreeMb: stats.vramFreeMb,
      },
      models: modelsWithCompatibility,
    });
  });

  // 1.1.1 Add Custom Model to Hub (Hugging Face / Direct URL)
  app.post('/api/models/hub/custom', async (c) => {
    const body = await c.req.json();
    const downloadUrl = (body.downloadUrl || '').trim();
    if (!downloadUrl) {
      return c.json({ error: 'downloadUrl is required' }, 400);
    }
    const parsed = parseModelMetadata(downloadUrl, body.name);
    const finalName = (body.name || '').trim() || parsed.name;
    const finalUrl = parsed.normalizedUrl;
    const id = body.id || `custom-${Date.now()}`;
    const filename = body.filename || `${finalName.replace(/\s+/g, '-').toLowerCase()}.gguf`;
    const customModel: ModelHubItem = {
      id,
      name: finalName,
      filename,
      author: body.author || parsed.author,
      description: body.description || `Mô hình tùy chỉnh từ Hugging Face / URL (${parsed.parameterSize}, ${parsed.quantization})`,
      parameterSize: body.parameterSize || parsed.parameterSize,
      quantization: body.quantization || parsed.quantization,
      fileSizeBytes: Number(body.fileSizeBytes) || parsed.fileSizeBytes,
      totalLayers: Number(body.totalLayers) || parsed.totalLayers,
      downloadUrl: finalUrl,
      tags: Array.isArray(body.tags) ? body.tags : ['HuggingFace', 'Custom', parsed.parameterSize, parsed.quantization],
      category: body.category || parsed.category,
    };
    db.saveCustomHubModel(customModel);
    return c.json(customModel);
  });

  // 1.1.2 Delete Custom Model from Hub
  app.delete('/api/models/hub/custom/:id', (c) => {
    const id = c.req.param('id');
    const deleted = db.deleteCustomHubModel(id);
    return c.json({ success: deleted });
  });

  // 1.1.3 Per-Model Preset Configurations
  app.get('/api/models/config/:filename', (c) => {
    const filename = decodeURIComponent(c.req.param('filename'));
    const savedConfig = db.getModelConfig(filename);
    const smartDefaults = getSmartModelPreset(filename);

    return c.json({
      filename,
      isCustomized: !!savedConfig,
      config: {
        temperature: savedConfig?.temperature ?? smartDefaults.temperature,
        topP: savedConfig?.topP ?? smartDefaults.topP,
        repeatPenalty: savedConfig?.repeatPenalty ?? smartDefaults.repeatPenalty,
        gpuLayers: savedConfig?.gpuLayers ?? smartDefaults.recommendedNgl,
        contextSize: savedConfig?.contextSize ?? smartDefaults.recommendedCtxSize,
        systemPromptMode: savedConfig?.systemPromptMode ?? smartDefaults.systemPromptMode,
        customInstructions: savedConfig?.customInstructions ?? '',
      },
      defaults: smartDefaults,
    });
  });

  app.post('/api/models/config/:filename', async (c) => {
    const filename = decodeURIComponent(c.req.param('filename'));
    const body = await c.req.json();
    db.saveModelConfig(filename, body);
    return c.json({ success: true, filename, config: db.getModelConfig(filename) });
  });

  app.delete('/api/models/config/:filename', (c) => {
    const filename = decodeURIComponent(c.req.param('filename'));
    db.deleteModelConfig(filename);
    return c.json({ success: true, filename });
  });

  // 1.2 Model Downloader Endpoints & Real-time Stream
  app.get('/api/models/downloads', (c) => {
    return c.json(ModelDownloaderService.getTasks());
  });

  app.get('/api/models/downloads/stream', (c) => {
    return streamSSE(c, async (stream) => {
      // Send initial snapshot of tasks
      await stream.writeSSE({
        event: 'initial',
        data: JSON.stringify(ModelDownloaderService.getTasks()),
      });

      const unsubscribe = ModelDownloaderService.subscribe(async (task) => {
        try {
          await stream.writeSSE({
            event: 'progress',
            data: JSON.stringify(task),
          });
        } catch {}
      });

      // Keep stream alive
      stream.onAbort(() => {
        unsubscribe();
      });

      while (!stream.aborted) {
        await new Promise((r) => setTimeout(r, 1000));
      }
      unsubscribe();
    });
  });

  app.post('/api/models/download', async (c) => {
    const { modelId, modelName, fileSizeBytes, filename, downloadUrl } = await c.req.json();
    const customModels = db.listCustomHubModels();
    const allModels = [...CURATED_MODELS, ...customModels];
    const curated = allModels.find((m) => m.id === modelId);

    const resolvedUrl = downloadUrl || curated?.downloadUrl;
    const resolvedFilename = filename || curated?.filename;

    const task = await ModelDownloaderService.startDownload(
      modelId,
      modelName,
      fileSizeBytes || curated?.fileSizeBytes || 2_000_000_000,
      resolvedFilename,
      resolvedUrl
    );
    return c.json(task);
  });

  app.post('/api/models/downloads/:id/cancel', (c) => {
    const id = c.req.param('id');
    const canceled = ModelDownloaderService.cancelDownload(id);
    return c.json({ success: canceled });
  });

  // 1.3 Hugging Face Hub Direct Search & Quantization Explorer (LM Studio Style)
  app.get('/api/hf/search', async (c) => {
    const query = (c.req.query('q') || '').trim();
    if (!query) {
      return c.json({ results: [] });
    }
    const limit = parseInt(c.req.query('limit') || '15', 10);
    try {
      const hfUrl = `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&filter=gguf&limit=${limit}&sort=downloads&direction=-1`;
      let res = await fetch(hfUrl, {
        headers: { 'User-Agent': 'LocalAI-Studio/1.0' },
        signal: AbortSignal.timeout(10000),
      });

      // Resilient fallback if Hugging Face filter=gguf returns 500 or error
      if (!res.ok) {
        const fallbackUrl = `https://huggingface.co/api/models?search=${encodeURIComponent(query + ' gguf')}&limit=${limit}&sort=downloads&direction=-1`;
        res = await fetch(fallbackUrl, {
          headers: { 'User-Agent': 'LocalAI-Studio/1.0' },
          signal: AbortSignal.timeout(10000),
        });
      }

      if (!res.ok) {
        return c.json(
          {
            error: `Máy chủ Hugging Face Hub phản hồi mã trạng thái ${res.status}. Vui lòng thử lại sau giây lát.`,
            results: [],
          },
          200
        );
      }

      const data: any = await res.json();
      const results = (Array.isArray(data) ? data : []).map((item: any) => {
        const id = item.id || item.modelId || '';
        const author = id.includes('/') ? id.split('/')[0] : 'Community';
        const name = id.includes('/') ? id.split('/')[1] : id;
        return {
          id,
          author,
          name,
          downloads: item.downloads || 0,
          likes: item.likes || 0,
          tags: item.tags || [],
          lastModified: item.lastModified || item.createdAt || '',
          pipelineTag: item.pipeline_tag || '',
        };
      });
      return c.json({ results });
    } catch (err: any) {
      console.error('[HF Hub Search Error]', err);
      return c.json(
        {
          error: 'Không thể kết nối đến máy chủ Hugging Face Hub. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.',
          results: [],
        },
        200
      );
    }
  });

  app.get('/api/hf/model-files', async (c) => {
    const repo = (c.req.query('repo') || '').trim();
    if (!repo) {
      return c.json({ error: 'repo parameter is required', files: [] }, 400);
    }
    try {
      // Clean repo path: Do NOT encode / to %2F as Hugging Face router requires /author/model
      const cleanRepo = repo.replace(/^\/+|\/+$/g, '');
      const safeRepoPath = cleanRepo.split('/').map(encodeURIComponent).join('/');

      let files: any[] = [];
      const treeRes = await fetch(`https://huggingface.co/api/models/${safeRepoPath}/tree/main?recursive=true`, {
        headers: { 'User-Agent': 'LocalAI-Studio/1.0' },
        signal: AbortSignal.timeout(12000),
      });

      if (treeRes.ok) {
        const treeData: any = await treeRes.json();
        if (Array.isArray(treeData)) {
          files = treeData
            .filter((item: any) => item.type === 'file' && item.path && item.path.toLowerCase().endsWith('.gguf'))
            .map((item: any) => {
              const filename = item.path.includes('/') ? item.path.split('/').pop() : item.path;
              const sizeBytes = item.size || (item.lfs && item.lfs.size) || 0;
              const sizeGb = Math.round((sizeBytes / (1024 * 1024 * 1024)) * 100) / 100;
              const meta = parseModelMetadata(`https://huggingface.co/${cleanRepo}/resolve/main/${item.path}`);
              return {
                filename,
                fullPath: item.path,
                sizeBytes,
                sizeGb: sizeGb || meta.estimatedGb,
                quantization: meta.quantization,
                parameterSize: meta.parameterSize,
                category: meta.category,
                downloadUrl: `https://huggingface.co/${cleanRepo}/resolve/main/${item.path}`,
              };
            });
        }
      }

      if (files.length === 0) {
        const detailRes = await fetch(`https://huggingface.co/api/models/${safeRepoPath}`, {
          headers: { 'User-Agent': 'LocalAI-Studio/1.0' },
          signal: AbortSignal.timeout(12000),
        });
        if (detailRes.ok) {
          const detailData: any = await detailRes.json();
          const siblings = detailData.siblings || [];
          files = siblings
            .filter((s: any) => s.rfilename && s.rfilename.toLowerCase().endsWith('.gguf'))
            .map((s: any) => {
              const filename = s.rfilename.includes('/') ? s.rfilename.split('/').pop() : s.rfilename;
              const meta = parseModelMetadata(`https://huggingface.co/${cleanRepo}/resolve/main/${s.rfilename}`);
              return {
                filename,
                fullPath: s.rfilename,
                sizeBytes: meta.fileSizeBytes,
                sizeGb: meta.estimatedGb,
                quantization: meta.quantization,
                parameterSize: meta.parameterSize,
                category: meta.category,
                downloadUrl: `https://huggingface.co/${cleanRepo}/resolve/main/${s.rfilename}`,
              };
            });
        }
      }

      return c.json({ repo: cleanRepo, files });
    } catch (err: any) {
      console.error('[HF Model Files Error]', err);
      return c.json({ error: err.message || 'Không thể tải danh sách tệp từ Hugging Face', files: [] }, 200);
    }
  });

  app.post('/api/hf/download', async (c) => {
    const body = await c.req.json();
    const { repo, filename, downloadUrl, sizeBytes, quantization, parameterSize, category } = body;
    if (!downloadUrl || !filename) {
      return c.json({ error: 'downloadUrl and filename are required' }, 400);
    }

    const modelName = body.name || filename.replace(/\.gguf$/i, '').replace(/[_-]/g, ' ');
    const author = (repo && repo.includes('/')) ? repo.split('/')[0] : 'HuggingFace';
    const id = `hf-${(repo || 'custom').replace(/[\/\s]/g, '-').toLowerCase()}-${filename.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()}`;

    const hubItem: ModelHubItem = {
      id,
      name: modelName,
      filename,
      author,
      description: `Mô hình Hugging Face từ ${repo || 'cộng đồng'} (${parameterSize || '7B'}, ${quantization || 'Q4_K_M'})`,
      parameterSize: parameterSize || '7B',
      quantization: quantization || 'Q4_K_M',
      fileSizeBytes: Number(sizeBytes) || 4_000_000_000,
      totalLayers: 32,
      downloadUrl,
      tags: ['HuggingFace', 'Hub', quantization || 'GGUF'],
      category: category || 'general',
    };

    db.saveCustomHubModel(hubItem);

    const task = await ModelDownloaderService.startDownload(
      hubItem.id,
      hubItem.name,
      hubItem.fileSizeBytes,
      hubItem.filename,
      hubItem.downloadUrl
    );

    return c.json({ success: true, model: hubItem, task });
  });

  app.delete('/api/models/local/:filename', async (c) => {
    const rawFilename = c.req.param('filename');
    const filename = decodeURIComponent(rawFilename);
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return c.json({ error: 'Invalid filename' }, 400);
    }

    // Release any file handle held by llama-server before attempting delete on Windows
    if (llamaManager.isRunning()) {
      try {
        await llamaManager.stopServer();
        await new Promise((r) => setTimeout(r, 200));
      } catch (e) {
        console.warn('[Models] Error stopping llama server before delete:', e);
      }
    }

    const home = process.env.USERPROFILE || process.env.HOME || os.homedir() || 'C:\\';
    const candidateDirs = [
      db.getModelsDir(),
      ModelDownloaderService.getModelsDir(),
      path.join(home, 'LocalAI', 'models'),
      path.resolve(process.cwd(), 'models'),
      path.join(os.tmpdir(), 'models'),
    ];

    let deleted = false;
    let deletedPath = '';

    for (const dir of candidateDirs) {
      if (!dir || !fs.existsSync(dir)) continue;

      // 1. Try exact path
      const target = path.join(dir, filename);
      if (fs.existsSync(target)) {
        try {
          fs.unlinkSync(target);
          if (fs.existsSync(`${target}.part`)) {
            try { fs.unlinkSync(`${target}.part`); } catch {}
          }
          deleted = true;
          deletedPath = target;
          break;
        } catch (err: any) {
          return c.json({ error: `Cannot delete file: ${err.message}` }, 500);
        }
      }

      // 2. Try case-insensitive and pattern search in directory
      try {
        const files = fs.readdirSync(dir);
        const match = files.find((f) => {
          const fl = f.toLowerCase();
          const targetLower = filename.toLowerCase();
          return (
            fl === targetLower ||
            fl === `${targetLower}.gguf` ||
            fl.replace(/-/g, '_') === targetLower.replace(/-/g, '_') ||
            (targetLower.endsWith('.gguf') && fl === targetLower.replace('.gguf', ''))
          );
        });
        if (match) {
          const matchTarget = path.join(dir, match);
          fs.unlinkSync(matchTarget);
          if (fs.existsSync(`${matchTarget}.part`)) {
            try { fs.unlinkSync(`${matchTarget}.part`); } catch {}
          }
          deleted = true;
          deletedPath = matchTarget;
          break;
        }
      } catch {}
    }

    // Always resync local provider
    const localLlama = db.getProvider('local-llama');
    if (localLlama) {
      db.syncLocalModels(localLlama);
    }

    if (deleted) {
      console.log(`[Models] Deleted model file: ${deletedPath}`);
      return c.json({ success: true, path: deletedPath });
    }

    // If file was already not on disk, return success so frontend state updates
    return c.json({ success: true, message: 'Model file not on disk or already removed' });
  });

  // 2. Workspaces & File Tree
  app.get('/api/workspaces', (c) => {
    return c.json(db.listWorkspaces());
  });

  app.post('/api/workspaces', async (c) => {
    const body = await c.req.json();
    const ws = db.saveWorkspace({
      id: body.id || `ws-${Date.now()}`,
      name: body.name || 'Untitled Workspace',
      folderPath: body.folderPath,
      systemPrompt: body.systemPrompt || '',
      pinnedFiles: body.pinnedFiles || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return c.json(ws);
  });

  app.delete('/api/workspaces/:id', (c) => {
    const id = c.req.param('id');
    db.deleteWorkspace(id);
    return c.json({ success: true });
  });

  app.patch('/api/workspaces/:id', async (c) => {
    const id = c.req.param('id');
    const ws = db.getWorkspace(id);
    if (!ws) return c.json({ error: 'Workspace not found' }, 404);
    const body = await c.req.json();
    if (body.name && typeof body.name === 'string') {
      ws.name = body.name.trim() || ws.name;
    }
    if (body.systemPrompt !== undefined) {
      ws.systemPrompt = body.systemPrompt;
    }
    const updated = db.saveWorkspace(ws);
    return c.json(updated);
  });

  app.get('/api/workspaces/:id/tree', (c) => {
    const id = c.req.param('id');
    const ws = db.getWorkspace(id);
    if (!ws) return c.json({ error: 'Workspace not found' }, 404);

    const tree = WorkspaceFS.getFileTree(ws.folderPath, 5);
    return c.json({ rootPath: ws.folderPath, tree });
  });

  app.get('/api/workspaces/:id/file', (c) => {
    const id = c.req.param('id');
    const relPath = c.req.query('path');
    if (!relPath) return c.json({ error: 'Query parameter "path" is required' }, 400);

    const ws = db.getWorkspace(id);
    if (!ws) return c.json({ error: 'Workspace not found' }, 404);

    try {
      // Normalize slashes for safe resolution on Windows
      const normalizedRel = relPath.replace(/\//g, path.sep);
      if (!WorkspaceFS.isSafePath(ws.folderPath, normalizedRel)) {
        return c.json({ error: 'Security Violation: Path traversal outside workspace boundary' }, 403);
      }
      let targetPath = '';
      try {
        const safePath = WorkspaceFS.resolveSafePath(ws.folderPath, normalizedRel);
        if (fs.existsSync(safePath) && !fs.statSync(safePath).isDirectory()) {
          targetPath = safePath;
        }
      } catch {}

      // Fallback: If not found directly, search recursively by filename within workspace
      if (!targetPath) {
        const baseName = path.basename(normalizedRel);
        const found = WorkspaceFS.findFileByName(ws.folderPath, baseName);
        if (found && fs.existsSync(found) && !fs.statSync(found).isDirectory()) {
          targetPath = found;
        }
      }

      if (!targetPath) {
        return c.json({ error: 'File not found' }, 404);
      }

      const safePath = targetPath;
      const stat = fs.statSync(safePath);
      // Large file protection: slice first 150KB for fast preview
      if (stat.size > 1.5 * 1024 * 1024) {
        const fd = fs.openSync(safePath, 'r');
        const buf = Buffer.alloc(120 * 1024);
        const bytesRead = fs.readSync(fd, buf, 0, 120 * 1024, 0);
        fs.closeSync(fd);
        const content = buf.toString('utf-8', 0, bytesRead) + `\n\n... [File truncated for preview: ${(stat.size / (1024 * 1024)).toFixed(2)} MB total]`;
        return c.json({ path: relPath, content, size: stat.size, truncated: true });
      }

      // Check if file is image or binary
      const ext = path.extname(safePath).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico'].includes(ext)) {
        const base64 = fs.readFileSync(safePath).toString('base64');
        const mime = ext === '.ico' ? 'image/x-icon' : `image/${ext.replace('.', '')}`;
        return c.json({ path: relPath, isImage: true, dataUrl: `data:${mime};base64,${base64}`, size: stat.size });
      }

      const content = fs.readFileSync(safePath, 'utf-8');
      return c.json({ path: relPath, content, size: stat.size });
    } catch (err: any) {
      return c.json({ error: err.message || 'Access denied or invalid file' }, 403);
    }
  });

  // 2.05 Offline RAG / Fast Code Retrieval across Workspace (Rust Accelerated)
  app.get('/api/workspaces/:id/rag/search', async (c) => {
    const id = c.req.param('id');
    const query = c.req.query('q') || '';
    const ws = db.getWorkspace(id);
    if (!ws) return c.json({ error: 'Workspace not found' }, 404);

    const { results, engine } = await WorkspaceFS.searchWorkspaceRAGAsync(ws.folderPath, query);
    return c.json({
      workspaceId: id,
      query,
      count: results.length,
      engine,
      results,
    });
  });

  // 2.1 Write / Save File to Workspace (Apply to File / Auto-Apply)
  app.post('/api/workspaces/:id/file/save', async (c) => {
    const id = c.req.param('id');
    const { path: relPath, content } = await c.req.json();
    if (!relPath || typeof content !== 'string') {
      return c.json({ error: 'path and content are required' }, 400);
    }

    const ws = db.getWorkspace(id);
    if (!ws) return c.json({ error: 'Workspace not found' }, 404);

    try {
      const normalizedRel = relPath.replace(/\//g, path.sep).trim();
      if (!WorkspaceFS.isSafePath(ws.folderPath, normalizedRel)) {
        return c.json({ error: 'Security Violation: Path traversal outside workspace boundary' }, 403);
      }

      const fullTargetPath = path.isAbsolute(normalizedRel)
        ? normalizedRel
        : path.resolve(ws.folderPath, normalizedRel);

      if (!WorkspaceFS.isSafePath(ws.folderPath, fullTargetPath)) {
        return c.json({ error: 'Security Violation: Path traversal outside workspace boundary' }, 403);
      }

      const parentDir = path.dirname(fullTargetPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      // Preserve previous version before overwrite for 1-click Revert/Undo
      let previousContent: string | null = null;
      if (fs.existsSync(fullTargetPath)) {
        try {
          previousContent = fs.readFileSync(fullTargetPath, 'utf-8');
          const backupDir = path.join(ws.folderPath, '.localai', 'backups');
          if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
          const safeBackupName = `${relPath.replace(/[/\\]/g, '_')}.${Date.now()}.bak`;
          fs.writeFileSync(path.join(backupDir, safeBackupName), previousContent, 'utf-8');
        } catch {}
      }

      const { updatedContent, appliedAsPatch } = WorkspaceFS.applyPatchOrFullContent(
        previousContent ?? '',
        content
      );

      fs.writeFileSync(fullTargetPath, updatedContent, 'utf-8');
      const stat = fs.statSync(fullTargetPath);

      return c.json({
        success: true,
        path: relPath,
        size: stat.size,
        previousContent,
        appliedAsPatch,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      return c.json({ error: err.message || 'Failed to save file' }, 500);
    }
  });

  // 2.2 Revert / Undo File Changes
  app.post('/api/workspaces/:id/file/revert', async (c) => {
    const id = c.req.param('id');
    const { path: relPath, previousContent } = await c.req.json();
    if (!relPath || typeof previousContent !== 'string') {
      return c.json({ error: 'path and previousContent are required' }, 400);
    }
    const ws = db.getWorkspace(id);
    if (!ws) return c.json({ error: 'Workspace not found' }, 404);
    try {
      const fullTargetPath = path.resolve(ws.folderPath, relPath.replace(/\//g, path.sep).trim());
      if (!WorkspaceFS.isSafePath(ws.folderPath, fullTargetPath)) {
        return c.json({ error: 'Access denied' }, 403);
      }
      fs.writeFileSync(fullTargetPath, previousContent, 'utf-8');
      return c.json({ success: true, reverted: true, path: relPath });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // 3. Sessions (Chats inside a Workspace)
  app.get('/api/workspaces/:id/sessions', (c) => {
    const wsId = c.req.param('id');
    return c.json(db.listSessions(wsId));
  });

  app.post('/api/workspaces/:id/sessions', async (c) => {
    const wsId = c.req.param('id');
    const body = await c.req.json();
    const session = db.saveSession({
      id: body.id || `sess-${Date.now()}`,
      workspaceId: wsId,
      title: body.title || 'New Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return c.json(session);
  });

  app.get('/api/sessions/:id/messages', (c) => {
    const sessId = c.req.param('id');
    return c.json(db.getMessages(sessId));
  });

  app.delete('/api/sessions/:id', (c) => {
    const sessId = c.req.param('id');
    db.deleteSession(sessId);
    return c.json({ success: true });
  });

  app.patch('/api/sessions/:id', async (c) => {
    const sessId = c.req.param('id');
    const session = db.getSession(sessId);
    if (!session) return c.json({ error: 'Session not found' }, 404);
    const body = await c.req.json();
    if (body.title && typeof body.title === 'string') {
      session.title = body.title.trim() || session.title;
    }
    const updated = db.saveSession(session);
    return c.json(updated);
  });

  // 4. Providers & API Keys (FreeLLM, OpenAI, Local)
  app.get('/api/providers', (c) => {
    return c.json({
      providers: db.listProviders(),
      activeProvider: router.getActiveProvider(),
    });
  });

  app.post('/api/providers', async (c) => {
    const body = await c.req.json();
    const saved = db.saveProvider(body);
    return c.json(saved);
  });

  app.post('/api/providers/:id/sync', async (c) => {
    const id = c.req.param('id');
    const result = await router.testAndSyncProvider(id);
    return c.json(result);
  });

  app.post('/api/providers/active', async (c) => {
    const { providerId } = await c.req.json();
    const active = await router.switchProvider(providerId);
    return c.json(active);
  });

  app.delete('/api/providers/:id', (c) => {
    const id = c.req.param('id');
    const deleted = db.deleteProvider(id);
    return c.json({ success: deleted });
  });

  // 5. Local Skills
  app.get('/api/skills', (c) => {
    const folders = db.listSkillFolders();
    const skills = SkillsScanner.scanDirectories(folders);
    return c.json({ folders, skills });
  });

  app.post('/api/skills/folders', async (c) => {
    const { folderPath } = await c.req.json();
    const updated = db.addSkillFolder(folderPath);
    return c.json({ folders: updated });
  });

  // 6. SSE Streaming Chat Endpoint
  app.post('/api/chat/stream', async (c) => {
    const { sessionId, prompt, contextFiles, workspaceId, sampling, defaultSystemPrompt, conciseMode } = await c.req.json();
    if (!sessionId || !prompt) {
      return c.json({ error: 'sessionId and prompt are required' }, 400);
    }

    const ws = workspaceId ? db.getWorkspace(workspaceId) : undefined;
    const activeProvider = router.getActiveProvider();
    const currentModelName = activeProvider?.selectedModel || '';

    // If model is a reasoning or small model, or if systemPromptMode is 'none', do NOT inject intrusive system prompts
    const isSmallOrReasoning = /r1|reason|1\.5b|1b|2b/i.test(currentModelName);
    const savedModelCfg = currentModelName ? db.getModelConfig(currentModelName) : undefined;
    const shouldOmitSystemPrompt = savedModelCfg?.systemPromptMode === 'none';

    let baseSystemPrompt = '';
    if (!shouldOmitSystemPrompt) {
      baseSystemPrompt = (ws?.systemPrompt || '').trim() || (defaultSystemPrompt || '').trim() || DEFAULT_SYSTEM_PROMPT;
    } else if (isSmallOrReasoning && !ws?.systemPrompt) {
      baseSystemPrompt = DEFAULT_SYSTEM_PROMPT;
    }

    // Check Skills
    const skillFolders = db.listSkillFolders();
    const availableSkills = SkillsScanner.scanDirectories(skillFolders);
    const triggeredSkillMatch = SkillsRunner.matchSlashCommand(prompt, availableSkills);

    const effectivePrompt = triggeredSkillMatch ? triggeredSkillMatch.cleanPrompt : prompt;
    let effectiveSystemPrompt = SkillsRunner.composeSystemPrompt(
      baseSystemPrompt,
      triggeredSkillMatch?.skill,
      availableSkills
    );

    // Automatically discover .localairules or .cursorrules in ws.folderPath (<= 3500 bytes)
    const projectRules = ws?.folderPath ? discoverWorkspaceRules(ws.folderPath) : null;
    if (projectRules) {
      effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n[PROJECT RULES]:\n${projectRules}`.trim();
    }

    // Concise Mode: Override sampling (temp=0.2, topP=0.85, repeatPenalty=1.10, maxTokens=1536) and prepend strict concise directive
    const effectiveSampling = conciseMode
      ? {
          temperature: 0.2,
          topP: 0.85,
          repeatPenalty: 1.10,
          maxTokens: 1536,
        }
      : sampling;

    if (conciseMode) {
      const CONCISE_DIRECTIVE = `[STRICT CONCISE MODE ACTIVE]: Output direct answers and production-ready code ONLY. Absolutely NO greetings, conversational filler, repeating the prompt, or polite closings. Use minimal bullet points for explanations.`;
      effectiveSystemPrompt = `${CONCISE_DIRECTIVE}\n\n${effectiveSystemPrompt}`.trim();
    }

    // Context bundle from tagged workspace files
    let loadedContextFiles: Array<{ path: string; content: string }> = [];
    if (ws && Array.isArray(contextFiles) && contextFiles.length > 0) {
      const bundle = ContextBuilder.buildContext(ws.folderPath, contextFiles);
      loadedContextFiles = bundle.files.map((f) => ({
        path: f.relativePath,
        content: f.content,
      }));
    }

    // 4. Lazy Workspace Environment Context Injection:
    // Only inject file tree when prompt is project-related or files are attached to avoid blowing prompt budget!
    let workspaceInfo = '';
    const isProjectRelated =
      loadedContextFiles.length > 0 ||
      !!projectRules ||
      /\b(file|tệp|thư mục|folder|dự án|project|cấu trúc|tree|code|src|build|test|bug|error|refactor|fix|component|api|func|hàm|lớp|class|mã)\b/i.test(
        effectivePrompt
      );

    if (isProjectRelated && ws && ws.folderPath && fs.existsSync(ws.folderPath)) {
      try {
        const tree = WorkspaceFS.getFileTree(ws.folderPath, 2);
        const formatSummary = (nodes: typeof tree, depth = 0): string => {
          if (depth > 2) return '';
          return nodes
            .slice(0, 15)
            .map((n) => `  ${'  '.repeat(depth)}- ${n.name}${n.isDirectory ? '/' : ''}`)
            .join('\n');
        };
        const summary = formatSummary(tree);
        workspaceInfo = `[NGỮ CẢNH DỰ ÁN ĐANG MỞ]\n- Tên dự án: ${ws.name}\n- Danh sách tệp tin/thư mục chính:\n${summary}\n[HƯỚNG DẪN CODE]: Luôn ghi rõ đường dẫn tệp ở đầu code block (ví dụ: // src/index.ts) để người dùng có thể áp dụng trực tiếp vào dự án.\n\n`;
      } catch {}
    }

    const finalPrompt = workspaceInfo
      ? `${workspaceInfo}--- YÊU CẦU CỦA NGƯỜI DÙNG ---\n${effectivePrompt}\n--- HẾT YÊU CẦU (Hãy tập trung trả lời đúng trọng tâm câu hỏi trên) ---`
      : effectivePrompt;

    return streamSSE(c, async (stream) => {
      try {
        if (triggeredSkillMatch) {
          await stream.writeSSE({
            event: 'skill_activated',
            data: JSON.stringify({
              name: triggeredSkillMatch.skill.name,
              trigger: triggeredSkillMatch.matchedTrigger,
            }),
          });
        }

        for await (const chunk of router.executeChatStream(sessionId, finalPrompt, {
          systemPrompt: effectiveSystemPrompt,
          contextFiles: loadedContextFiles,
          temperature: effectiveSampling?.temperature,
          topP: effectiveSampling?.topP,
          maxTokens: effectiveSampling?.maxTokens,
          repeatPenalty: effectiveSampling?.repeatPenalty,
        })) {
          await stream.writeSSE({
            event: chunk.done ? 'done' : 'message',
            data: JSON.stringify(chunk),
          });
        }
      } catch (err: any) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message: err.message }),
        });
      }
    });
  });

  // 6.1 Swarm Sequential Multi-Agent Execution Endpoint
  app.post('/api/swarm/execute-stream', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const {
      sessionId,
      prompt,
      workspaceId,
      testCommand,
      contextFiles,
      maxIterations,
      sampling,
      conciseMode,
    } = body;

    if (!prompt) {
      return c.json({ error: 'prompt is required' }, 400);
    }

    const ws = workspaceId ? db.getWorkspace(workspaceId) : undefined;
    const projectRules = ws?.folderPath ? discoverWorkspaceRules(ws.folderPath) : undefined;

    let loadedContextFiles: Array<{ path: string; content: string }> = [];
    if (ws && Array.isArray(contextFiles) && contextFiles.length > 0) {
      const bundle = ContextBuilder.buildContext(ws.folderPath, contextFiles);
      loadedContextFiles = bundle.files.map((f) => ({
        path: f.relativePath,
        content: f.content,
      }));
    }

    const effectiveSampling = conciseMode
      ? {
          temperature: 0.2,
          topP: 0.85,
          repeatPenalty: 1.10,
          maxTokens: 1536,
        }
      : sampling;

    return streamSSE(c, async (stream) => {
      let accumulatedContent = '';
      try {
        for await (const event of swarmEngine.executeStream({
          sessionId,
          taskPrompt: prompt,
          workspacePath: ws?.folderPath,
          testCommand,
          contextFiles: loadedContextFiles,
          maxIterations: maxIterations || 2,
          systemRules: projectRules || undefined,
          sampling: effectiveSampling,
        })) {
          if (event.type === 'agent_step') {
            await stream.writeSSE({
              event: 'agent_step',
              data: JSON.stringify(event),
            });
          } else if (event.type === 'harness_result') {
            await stream.writeSSE({
              event: 'harness_result',
              data: JSON.stringify(event),
            });
          } else if (event.type === 'chunk') {
            if (event.content) accumulatedContent += event.content;
            await stream.writeSSE({
              event: 'message',
              data: JSON.stringify(event),
            });
          } else if (event.type === 'done') {
            await stream.writeSSE({
              event: 'done',
              data: JSON.stringify(event),
            });
          } else if (event.type === 'error') {
            await stream.writeSSE({
              event: 'error',
              data: JSON.stringify(event),
            });
          }
        }

        if (sessionId && accumulatedContent) {
          db.addMessage({
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            sessionId,
            role: 'assistant',
            content: accumulatedContent,
            modelUsed: 'Biệt đội AI (Swarm)',
            createdAt: Date.now(),
          });
        }
      } catch (err: any) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message: err.message }),
        });
      }
    });
  });

  // 7. Auto-Route Classification Endpoint
  app.post('/api/auto-route/classify', async (c) => {
    const { prompt, contextTokens, hasImageAttachment, config } = await c.req.json();
    const result = AutoModelRouter.routePrompt(
      prompt || '',
      contextTokens || 0,
      !!hasImageAttachment,
      config || DEFAULT_AUTO_ROUTE_CONFIG
    );
    return c.json(result);
  });

  // 8. In-App Terminal Command Execution with Security Sandbox
  const DANGEROUS_COMMAND_PATTERNS = [
    /format\s+[a-zA-Z]:/i,
    /format-volume/i,
    /diskpart/i,
    /bcdedit/i,
    /reg\s+delete\s+(hklm|hkey_local_machine)/i,
    /rmdir\s+.*\/s.*\/q.*[cC]:\\/i,
    /del\s+.*\/f.*\/s.*\/q.*[cC]:\\/i,
    /remove-item.*-(recurse|r).*(c:\\|\$env:systemroot|system32)/i,
    /stop-process.*-(name|id).*(csrss|lsass|smss|svchost)/i,
    /taskkill.*\/im\s+(csrss|lsass|smss)\.exe/i,
    /:[(][{]\s*:\|:&\s*[}][)];:/,
  ];

  app.post('/api/terminal/run', async (c) => {
    const { command, cwd, bypassSafetyCheck, shell } = await c.req.json();
    if (!command || typeof command !== 'string') {
      return c.json({ error: 'Command is required' }, 400);
    }

    if (command.length > 4000) {
      return c.json({ error: 'Command exceeds 4000 characters limit' }, 400);
    }

    // Security Sandbox check
    if (!bypassSafetyCheck) {
      const isDangerous = DANGEROUS_COMMAND_PATTERNS.some((pattern) => pattern.test(command));
      if (isDangerous) {
        return c.json(
          {
            error: 'Security Sandbox: Destructive system operation blocked for safety.',
            blocked: true,
            suggestion: 'To execute potentially destructive system commands, explicit bypass authorization is required.',
          },
          403
        );
      }
    }

    const workingDir = cwd && fs.existsSync(cwd) ? cwd : process.cwd();
    const start = Date.now();
    const chosenShell = shell === 'cmd' ? 'cmd.exe' : shell === 'bash' ? 'bash.exe' : 'powershell.exe';

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        shell: chosenShell,
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 4,
      });

      return c.json({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
        durationMs: Date.now() - start,
      });
    } catch (err: any) {
      return c.json({
        stdout: err.stdout?.trim() || '',
        stderr: err.stderr?.trim() || err.message,
        exitCode: err.code || 1,
        durationMs: Date.now() - start,
      });
    }
  });

  // 9. App Version & Update Engine
  app.get('/api/app/version', (c) => {
    return c.json(AppUpdater.getAppInfo());
  });

  app.get('/api/app/check-update', async (c) => {
    const owner = c.req.query('owner') || 'TuilaTammmmm';
    const repo = c.req.query('repo') || 'LocalWorkspace';
    const updateInfo = await AppUpdater.checkForUpdates(owner, repo);
    return c.json(updateInfo);
  });

  // 10. Native OS Folder Picker & Common Paths
  app.post('/api/dialog/pick-folder', async (c) => {
    try {
      if (process.platform === 'win32') {
        const psScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.Opacity = 0
$form.Show()
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog
$dlg.Description = 'Chọn thư mục dự án LocalAI'
$dlg.ShowNewFolderButton = $true
if ($dlg.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $dlg.SelectedPath
}
$form.Close()
$form.Dispose()
$dlg.Dispose()
`.trim();
        const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
        return new Promise<Response>((resolve) => {
          execFile('powershell.exe', ['-NoProfile', '-Sta', '-EncodedCommand', encoded], { timeout: 60000 }, (err, stdout) => {
            if (err) {
              resolve(c.json({ path: null, error: err.message }));
              return;
            }
            const selected = stdout.trim();
            if (selected) {
              resolve(c.json({ path: selected, name: path.basename(selected) }));
            } else {
              resolve(c.json({ path: null }));
            }
          });
        });
      } else {
        return c.json({ path: null });
      }
    } catch (err: any) {
      return c.json({ error: err.message, path: null }, 500);
    }
  });

  app.get('/api/dialog/system-folders', (c) => {
    const home = os.homedir();
    return c.json({
      current: process.cwd(),
      home,
      desktop: path.join(home, 'Desktop'),
      documents: path.join(home, 'Documents'),
      models: db.getModelsDir(),
    });
  });

  app.post('/api/settings/models-dir', async (c) => {
    const body = await c.req.json();
    const folderPath = body.folderPath;
    if (!folderPath || typeof folderPath !== 'string') {
      return c.json({ error: 'Valid folderPath is required' }, 400);
    }
    const updated = db.setModelsDir(folderPath);
    ModelDownloaderService.setModelsDir(updated);
    return c.json({ models: updated });
  });

  app.get('/api/settings/model-dirs', (c) => {
    return c.json({
      defaultDir: db.getModelsDir(),
      customDirs: db.getCustomModelDirs(),
      allDirs: db.getAllModelDirs(),
    });
  });

  app.post('/api/settings/model-dirs/add', async (c) => {
    const body = await c.req.json();
    const folderPath = body.folderPath;
    if (!folderPath || typeof folderPath !== 'string') {
      return c.json({ error: 'Valid folderPath is required' }, 400);
    }
    const updated = db.addCustomModelDir(folderPath);
    return c.json({ customDirs: updated, allDirs: db.getAllModelDirs() });
  });

  app.post('/api/settings/model-dirs/remove', async (c) => {
    const body = await c.req.json();
    const folderPath = body.folderPath;
    if (!folderPath || typeof folderPath !== 'string') {
      return c.json({ error: 'Valid folderPath is required' }, 400);
    }
    const updated = db.removeCustomModelDir(folderPath);
    return c.json({ customDirs: updated, allDirs: db.getAllModelDirs() });
  });

  // 11. Open in Windows Explorer (Instant detach without hanging)
  app.post('/api/dialog/open-folder', async (c) => {
    try {
      const body = await c.req.json();
      const folderPath = body.path || process.cwd();
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      if (process.platform === 'win32') {
        spawn('explorer.exe', [folderPath], { detached: true, stdio: 'ignore' }).unref();
      }
      return c.json({ success: true, opened: folderPath });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  // 12. Clear Cache & Temp Logs
  app.post('/api/app/clear-cache', (c) => {
    try {
      const tempDirs = [path.join(process.cwd(), '.tmp')];
      let clearedFiles = 0;
      for (const dir of tempDirs) {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
          clearedFiles++;
        }
      }
      return c.json({ success: true, clearedCount: clearedFiles, message: 'App cache & temp files cleared.' });
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 500);
    }
  });

  return app;
}
