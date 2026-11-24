import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface DownloadTask {
  modelId: string;
  name: string;
  status: 'idle' | 'downloading' | 'paused' | 'completed' | 'error';
  progressPercent: number;
  downloadedBytes: number;
  totalBytes: number;
  speedMbps: number;
  filePath?: string;
  downloadUrl?: string;
  filename?: string;
  error?: string;
}

export class ModelDownloaderService {
  private static tasks: Map<string, DownloadTask> = new Map();
  private static abortControllers: Map<string, AbortController> = new Map();
  private static listeners: Set<(task: DownloadTask) => void> = new Set();
  private static modelsDir = '';

  public static setModelsDir(dir: string): void {
    this.modelsDir = dir;
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {}
    }
  }

  public static getModelsDir(): string {
    if (this.modelsDir && fs.existsSync(this.modelsDir)) {
      return this.modelsDir;
    }
    if (process.env.LOCALAI_MODELS_DIR && fs.existsSync(process.env.LOCALAI_MODELS_DIR)) {
      return process.env.LOCALAI_MODELS_DIR;
    }
    // Permanent user directory, NEVER inside Temp
    const home = process.env.USERPROFILE || process.env.HOME || os.homedir() || 'C:\\';
    const defaultDir = path.join(home, 'LocalAI', 'models');

    if (!fs.existsSync(defaultDir)) {
      try {
        fs.mkdirSync(defaultDir, { recursive: true });
      } catch {}
    }
    return defaultDir;
  }

  public static getTasks(): DownloadTask[] {
    return Array.from(this.tasks.values());
  }

  public static getTask(modelId: string): DownloadTask | undefined {
    return this.tasks.get(modelId);
  }

  public static subscribe(listener: (task: DownloadTask) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notify(task: DownloadTask): void {
    for (const listener of this.listeners) {
      try {
        listener(task);
      } catch {}
    }
  }

  /**
   * Automatically fetch tokenizer.json from Hugging Face repository and save alongside .gguf
   */
  public static async downloadTokenizerForModel(downloadUrl: string, destGgufPath: string): Promise<string | null> {
    try {
      const match = downloadUrl.match(/huggingface\.co\/([^/]+\/[^/]+)/i);
      if (!match) return null;
      const repo = match[1];
      const dir = path.dirname(destGgufPath);
      const baseName = path.basename(destGgufPath).replace(/\.gguf$/i, '');
      const targetFile = path.join(dir, `${baseName}.tokenizer.json`);

      // Try multiple URL variants (GGUF quant repo, or base model repo without -GGUF)
      const candidateUrls = [
        `https://huggingface.co/${repo}/resolve/main/tokenizer.json`,
        `https://huggingface.co/${repo.replace(/-GGUF$/i, '')}/resolve/main/tokenizer.json`,
        `https://huggingface.co/${repo.replace(/-gguf$/i, '')}/resolve/main/tokenizer.json`,
      ];

      for (const url of candidateUrls) {
        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': 'LocalAI-Studio/1.0' },
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            const text = await res.text();
            if (text && text.trim().startsWith('{') && text.includes('"version"')) {
              fs.writeFileSync(targetFile, text, 'utf-8');
              console.log(`[Downloader] Bundled tokenizer.json for Rust Tokenizer: ${targetFile}`);
              return targetFile;
            }
          }
        } catch {}
      }
    } catch (err) {
      console.warn('[Downloader] Could not download tokenizer.json:', err);
    }
    return null;
  }

  /**
   * Pause an in-progress download task (preserves .part file on disk)
   */
  public static pauseDownload(modelId: string): boolean {
    const task = this.tasks.get(modelId);
    if (!task || task.status !== 'downloading') return false;

    task.status = 'paused';
    task.speedMbps = 0;
    this.tasks.set(modelId, { ...task });

    const controller = this.abortControllers.get(modelId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(modelId);
    }

    this.notify(task);
    console.log(`[Downloader] Download paused for: ${modelId} (${task.downloadedBytes} bytes preserved)`);
    return true;
  }

  /**
   * Resume a paused or interrupted download task
   */
  public static async resumeDownload(modelId: string): Promise<DownloadTask | null> {
    const task = this.tasks.get(modelId);
    if (!task) return null;
    if (task.status === 'downloading') return task;

    return this.startDownload(
      task.modelId,
      task.name,
      task.totalBytes,
      task.filename,
      task.downloadUrl,
      true
    );
  }

  /**
   * Cancel an in-progress download task
   */
  public static cancelDownload(modelId: string): boolean {
    const controller = this.abortControllers.get(modelId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(modelId);
    }

    const task = this.tasks.get(modelId);
    if (!task) return false;

    // Clean up partial file if exists
    if (task.filePath) {
      const partPath = `${task.filePath}.part`;
      if (fs.existsSync(partPath)) {
        try { fs.unlinkSync(partPath); } catch {}
      }
    }

    task.status = 'idle';
    task.progressPercent = 0;
    task.downloadedBytes = 0;
    task.speedMbps = 0;
    this.tasks.delete(modelId);
    this.notify({ ...task, status: 'idle' });
    return true;
  }

  /**
   * Build direct Hugging Face resolve URL
   */
  private static resolveDirectUrls(baseUrl: string, filename: string): string[] {
    try {
      const parsed = new URL(baseUrl);
      if (parsed.pathname.toLowerCase().endsWith('.gguf')) {
        return [baseUrl];
      }
    } catch {
      if (baseUrl.toLowerCase().split('?')[0].endsWith('.gguf')) {
        return [baseUrl];
      }
    }
    const clean = baseUrl.replace(/\/+$/, '');
    return [
      `${clean}/resolve/main/${filename.toLowerCase()}`,
      `${clean}/resolve/main/${filename}`,
    ];
  }

  /**
   * Start real streaming download of model GGUF file with real-time notifications & HTTP Range resume
   */
  public static async startDownload(
    modelId: string,
    modelName: string,
    fileSizeBytes: number,
    targetFilename?: string,
    downloadUrl?: string,
    resumeRequested = false
  ): Promise<DownloadTask> {
    const dir = this.getModelsDir();
    const actualFilename = targetFilename || `${modelId}.gguf`;
    const destPath = path.join(dir, actualFilename);
    const partPath = `${destPath}.part`;

    // Abort previous controller if any
    const existingController = this.abortControllers.get(modelId);
    if (existingController) {
      existingController.abort();
      this.abortControllers.delete(modelId);
    }

    const abortController = new AbortController();
    this.abortControllers.set(modelId, abortController);

    // Calculate existing bytes on disk for Range request
    let existingBytes = 0;
    if (fs.existsSync(partPath)) {
      try {
        existingBytes = fs.statSync(partPath).size;
      } catch {}
    }

    if (!resumeRequested && existingBytes >= fileSizeBytes && fileSizeBytes > 0) {
      existingBytes = 0;
      try { fs.unlinkSync(partPath); } catch {}
    }

    const initialPercent = fileSizeBytes > 0 && existingBytes > 0
      ? Math.min(99, Math.round((existingBytes / fileSizeBytes) * 100))
      : 0;

    const task: DownloadTask = {
      modelId,
      name: modelName,
      status: 'downloading',
      progressPercent: initialPercent,
      downloadedBytes: existingBytes,
      totalBytes: fileSizeBytes,
      speedMbps: 0,
      filePath: destPath,
      downloadUrl,
      filename: actualFilename,
    };
    this.tasks.set(modelId, task);
    this.notify(task);

    // Run real download in background
    (async () => {
      try {
        if (!downloadUrl) {
          throw new Error('No download URL provided for model');
        }

        const candidateUrls = this.resolveDirectUrls(downloadUrl, actualFilename);
        let activeResponse: Response | null = null;

        for (const candidate of candidateUrls) {
          try {
            console.log(`[Downloader] Trying URL: ${candidate} (Range: ${existingBytes} bytes)`);
            const headers: Record<string, string> = { 'User-Agent': 'LocalAI-Studio/1.0' };
            if (existingBytes > 0) {
              headers['Range'] = `bytes=${existingBytes}-`;
            }

            const res = await fetch(candidate, {
              method: 'GET',
              headers,
              redirect: 'follow',
              signal: abortController.signal,
            });

            if ((res.ok || res.status === 206) && res.body) {
              activeResponse = res;
              break;
            }
          } catch (err: any) {
            if (err.name === 'AbortError') throw err;
          }
        }

        if (!activeResponse || !activeResponse.body) {
          throw new Error(`Failed to initiate download stream from Hugging Face`);
        }

        const isPartial = activeResponse.status === 206;
        let downloaded = isPartial ? existingBytes : 0;

        const totalHeader = activeResponse.headers.get('content-length');
        const total = isPartial
          ? existingBytes + (totalHeader ? parseInt(totalHeader, 10) : 0)
          : (totalHeader ? parseInt(totalHeader, 10) : fileSizeBytes);
        task.totalBytes = total;

        const fileStream = fs.createWriteStream(partPath, { flags: isPartial ? 'a' : 'w' });
        const reader = activeResponse.body.getReader();

        let lastReportTime = Date.now();
        let lastReportBytes = downloaded;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          fileStream.write(Buffer.from(value));
          downloaded += value.length;
          task.downloadedBytes = downloaded;
          task.progressPercent = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;

          const now = Date.now();
          const elapsedSec = (now - lastReportTime) / 1000;
          if (elapsedSec >= 0.5) {
            const bytesDelta = downloaded - lastReportBytes;
            task.speedMbps = parseFloat(((bytesDelta / (1024 * 1024)) / elapsedSec).toFixed(1));
            lastReportTime = now;
            lastReportBytes = downloaded;
            this.tasks.set(modelId, { ...task });
            this.notify(task);
          }
        }

        await new Promise<void>((resolve, reject) => {
          fileStream.end((err?: Error | null) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // Rename .part to final destination
        if (fs.existsSync(destPath)) {
          try { fs.unlinkSync(destPath); } catch {}
        }
        fs.renameSync(partPath, destPath);

        // Automatically fetch and bundle tokenizer.json alongside .gguf for Rust Tokenizer
        if (downloadUrl) {
          await ModelDownloaderService.downloadTokenizerForModel(downloadUrl, destPath);
        }

        task.status = 'completed';
        task.progressPercent = 100;
        task.downloadedBytes = total;
        task.speedMbps = 0;
        this.tasks.set(modelId, { ...task });
        this.notify(task);
        console.log(`[Downloader] Model download finished: ${destPath} (${total} bytes)`);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          const cur = this.tasks.get(modelId);
          if (cur?.status === 'paused') {
            console.log(`[Downloader] Download paused cleanly: ${modelId}`);
            return;
          }
          console.log(`[Downloader] Download canceled: ${modelId}`);
          return;
        }
        console.error(`[Downloader] Download error for ${modelId}:`, err);
        task.status = 'error';
        task.error = err.message || 'Download failed';
        this.tasks.set(modelId, { ...task });
        this.notify(task);
      } finally {
        this.abortControllers.delete(modelId);
      }
    })();

    return task;
  }
}
