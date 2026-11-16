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
import { ModelHubService, CURATED_MODELS } from './model-hub.js';
import { ModelDownloaderService } from './model-downloader.js';
import { AppUpdater } from './updater.js';
import { exec } from 'node:child_process';
import util from 'node:util';
import os from 'node:os';
import path from 'node:path';

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
    const modelsWithCompatibility = CURATED_MODELS.map((model) => {
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

  // 1.2 Model Downloader Endpoints
  app.get('/api/models/downloads', (c) => {
    return c.json(ModelDownloaderService.getTasks());
  });

  app.post('/api/models/download', async (c) => {
    const { modelId, modelName, fileSizeBytes } = await c.req.json();
    const task = await ModelDownloaderService.startDownload(
      modelId,
      modelName,
      fileSizeBytes || 2_000_000_000
    );
    return c.json(task);
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

  app.get('/api/workspaces/:id/tree', (c) => {
    const id = c.req.param('id');
    const ws = db.getWorkspace(id);
    if (!ws) return c.json({ error: 'Workspace not found' }, 404);

    const tree = WorkspaceFS.getFileTree(ws.folderPath, 5);
    return c.json({ rootPath: ws.folderPath, tree });
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

  // 8. In-App Terminal Command Execution
  app.post('/api/terminal/run', async (c) => {
    const { command, cwd } = await c.req.json();
    if (!command || typeof command !== 'string') {
      return c.json({ error: 'Command is required' }, 400);
    }

    const workingDir = cwd || process.cwd();
    const start = Date.now();

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        shell: 'powershell.exe',
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
      const psScript = `[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = 'Select Project Folder'; $d.ShowNewFolderButton = $true; if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.SelectedPath }`;
      const { stdout } = await execAsync(`powershell -Sta -NoProfile -Command "${psScript}"`, {
        timeout: 120000,
      });
      const selected = stdout.trim();
      if (selected) {
        return c.json({ path: selected, name: path.basename(selected) });
      }
      return c.json({ path: null });
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

  // 11. Open in Windows Explorer
  app.post('/api/dialog/open-folder', async (c) => {
    try {
      const body = await c.req.json();
      const folderPath = body.path || process.cwd();
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      await execAsync(`explorer "${folderPath}"`);
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
