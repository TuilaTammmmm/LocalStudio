import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface DownloadTask {
  modelId: string;
  name: string;
  status: 'idle' | 'downloading' | 'completed' | 'error';
  progressPercent: number;
  downloadedBytes: number;
  totalBytes: number;
  speedMbps: number;
  filePath?: string;
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
    this.tasks.set(modelId, task);
    this.notify(task);
    return true;
  }

  /**
   * Build direct Hugging Face resolve URL
   */
  private static resolveDirectUrls(baseUrl: string, filename: string): string[] {
    if (baseUrl.endsWith('.gguf')) {
      return [baseUrl];
    }
    const clean = baseUrl.replace(/\/+$/, '');
    return [
      `${clean}/resolve/main/${filename.toLowerCase()}`,
      `${clean}/resolve/main/${filename}`,
    ];
  }

  /**
   * Start real streaming download of model GGUF file with real-time notifications
   */
  public static async startDownload(
    modelId: string,
    modelName: string,
    fileSizeBytes: number,
    targetFilename?: string,
    downloadUrl?: string
  ): Promise<DownloadTask> {
    const dir = this.getModelsDir();
    const actualFilename = targetFilename || `${modelId}.gguf`;
    const destPath = path.join(dir, actualFilename);
    const partPath = `${destPath}.part`;

    // Cancel existing if already running
    if (this.abortControllers.has(modelId)) {
      this.cancelDownload(modelId);
    }

    const abortController = new AbortController();
    this.abortControllers.set(modelId, abortController);

    const task: DownloadTask = {
      modelId,
      name: modelName,
      status: 'downloading',
      progressPercent: 0,
      downloadedBytes: 0,
      totalBytes: fileSizeBytes,
      speedMbps: 0,
      filePath: destPath,
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
            console.log(`[Downloader] Trying URL: ${candidate}`);
            const res = await fetch(candidate, {
              method: 'GET',
              headers: { 'User-Agent': 'LocalAI-Studio/1.0' },
              redirect: 'follow',
              signal: abortController.signal,
            });

            if (res.ok && res.body) {
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

        const totalHeader = activeResponse.headers.get('content-length');
        const total = totalHeader ? parseInt(totalHeader, 10) : fileSizeBytes;
        task.totalBytes = total;

        const fileStream = fs.createWriteStream(partPath);
        const reader = activeResponse.body.getReader();

        let downloaded = 0;
        let lastReportTime = Date.now();
        let lastReportBytes = 0;

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

        task.status = 'completed';
        task.progressPercent = 100;
        task.downloadedBytes = total;
        task.speedMbps = 0;
        this.tasks.set(modelId, { ...task });
        this.notify(task);
        console.log(`[Downloader] Model download finished: ${destPath} (${total} bytes)`);
      } catch (err: any) {
        if (err.name === 'AbortError') {
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
