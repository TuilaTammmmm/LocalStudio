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
import { ModelHubService, CURATED_MODELS, type ModelHubItem } from './model-hub.js';
import { ModelDownloaderService } from './model-downloader.js';
import { AppUpdater } from './updater.js';
import { exec, spawn, execFile } from 'node:child_process';
import util from 'node:util';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const execAsync = util.promisify(exec);

export function createServer(
  db: DatabaseService,
  llamaManager: LlamaProcessManager,
  router: MultiProviderRouter
) {
  const app = new Hono();
  const hwMonitor = new HardwareMonitor();

  app.use('/*', cors());

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

  // 1.1 LM Studio-Style Model Hub & Compatibility
  app.get('/api/models/hub', async (c) => {
    const stats = await hwMonitor.getStats();
    const customModels = db.listCustomHubModels();
    const allModels = [...CURATED_MODELS, ...customModels];
    const modelsWithCompatibility = allModels.map((model) => {
      const evaluation = ModelHubService.evaluateCompatibility(
        model,
        stats.vramTotalMb || 4096,
        stats.vramFreeMb || 3600
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
    if (!body.name || !body.downloadUrl) {
      return c.json({ error: 'Name and downloadUrl are required' }, 400);
    }
    const id = body.id || `custom-${Date.now()}`;
    const filename = body.filename || `${body.name.replace(/\s+/g, '-').toLowerCase()}.gguf`;
    const customModel: ModelHubItem = {
      id,
      name: body.name,
      filename,
      author: body.author || 'Community',
      description: body.description || `Custom model added from Hugging Face / URL`,
      parameterSize: body.parameterSize || '7B',
      quantization: body.quantization || 'Q4_K_M',
      fileSizeBytes: Number(body.fileSizeBytes) || 4_000_000_000,
      totalLayers: Number(body.totalLayers) || 32,
      downloadUrl: body.downloadUrl,
      tags: Array.isArray(body.tags) ? body.tags : ['HuggingFace', 'Custom'],
      category: body.category || 'general',
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
    const { modelId, modelName, fileSizeBytes, filename } = await c.req.json();
    const task = await ModelDownloaderService.startDownload(
      modelId,
      modelName,
      fileSizeBytes || 2_000_000_000,
      filename
    );
    return c.json(task);
  });

  app.post('/api/models/downloads/:id/cancel', (c) => {
    const id = c.req.param('id');
    const canceled = ModelDownloaderService.cancelDownload(id);
    return c.json({ success: canceled });
  });

  app.delete('/api/models/local/:filename', (c) => {
    const filename = c.req.param('filename');
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return c.json({ error: 'Invalid filename' }, 400);
    }
    const modelsDir = path.resolve(process.cwd(), 'models');
    const target = path.join(modelsDir, filename);
    if (fs.existsSync(target)) {
      try {
        fs.unlinkSync(target);
        const localLlama = db.getProvider('local-llama');
        if (localLlama) {
          db.syncLocalModels(localLlama);
        }
        return c.json({ success: true });
      } catch (err: any) {
        return c.json({ error: err.message }, 500);
      }
    }
    return c.json({ error: 'File not found' }, 404);
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
      const safePath = WorkspaceFS.resolveSafePath(ws.folderPath, normalizedRel);
      if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
        return c.json({ error: 'File not found' }, 404);
      }

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
    const { sessionId, prompt, contextFiles, workspaceId } = await c.req.json();
    if (!sessionId || !prompt) {
      return c.json({ error: 'sessionId and prompt are required' }, 400);
    }

    const ws = workspaceId ? db.getWorkspace(workspaceId) : undefined;
    const baseSystemPrompt = ws?.systemPrompt || '';

    // Check Skills
    const skillFolders = db.listSkillFolders();
    const availableSkills = SkillsScanner.scanDirectories(skillFolders);
    const triggeredSkillMatch = SkillsRunner.matchSlashCommand(prompt, availableSkills);

    const effectivePrompt = triggeredSkillMatch ? triggeredSkillMatch.cleanPrompt : prompt;
    const effectiveSystemPrompt = SkillsRunner.composeSystemPrompt(
      baseSystemPrompt,
      triggeredSkillMatch?.skill,
      availableSkills
    );

    // Context bundle from tagged workspace files
    let loadedContextFiles: Array<{ path: string; content: string }> = [];
    if (ws && Array.isArray(contextFiles) && contextFiles.length > 0) {
      const bundle = ContextBuilder.buildContext(ws.folderPath, contextFiles);
      loadedContextFiles = bundle.files.map((f) => ({
        path: f.relativePath,
        content: f.content,
      }));
    }

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

        for await (const chunk of router.executeChatStream(sessionId, effectivePrompt, {
          systemPrompt: effectiveSystemPrompt,
          contextFiles: loadedContextFiles,
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
    const owner = c.req.query('owner') || 'tam-code';
    const repo = c.req.query('repo') || 'LocalAI';
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
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinHelper {
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.StartPosition = 'CenterScreen'
$form.WindowState = 'Minimized'
$form.Show()
$form.WindowState = 'Normal'
$form.Activate()
$form.BringToFront()
[WinHelper]::SetForegroundWindow($form.Handle)
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
      models: path.join(process.cwd(), 'models'),
    });
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
