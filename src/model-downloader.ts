import fs from 'node:fs';
import path from 'node:path';

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
  private static intervals: Map<string, NodeJS.Timeout> = new Map();
  private static listeners: Set<(task: DownloadTask) => void> = new Set();
  private static modelsDir = path.resolve(process.cwd(), 'models');

  public static getModelsDir(): string {
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }
    return this.modelsDir;
  }

  public static getTasks(): DownloadTask[] {
    return Array.from(this.tasks.values());
  }

  public static getTask(modelId: string): DownloadTask | undefined {
    return this.tasks.get(modelId);
  }

  /**
   * Subscribe to real-time download progress events
   */
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
    const timer = this.intervals.get(modelId);
    if (timer) {
      clearInterval(timer);
      this.intervals.delete(modelId);
    }

    const task = this.tasks.get(modelId);
    if (!task) return false;

    task.status = 'idle';
    task.progressPercent = 0;
    task.downloadedBytes = 0;
    this.tasks.set(modelId, task);
    this.notify(task);
    return true;
  }

  /**
   * Start asynchronous download of model GGUF file with real-time notifications
   */
  public static async startDownload(
    modelId: string,
    modelName: string,
    fileSizeBytes: number,
    targetFilename?: string
  ): Promise<DownloadTask> {
    const dir = this.getModelsDir();
    const actualFilename = targetFilename || `${modelId}.gguf`;
    const destPath = path.join(dir, actualFilename);

    // Cancel existing interval if already running
    if (this.intervals.has(modelId)) {
      clearInterval(this.intervals.get(modelId)!);
      this.intervals.delete(modelId);
    }

    const task: DownloadTask = {
      modelId,
      name: modelName,
      status: 'downloading',
      progressPercent: 0,
      downloadedBytes: 0,
      totalBytes: fileSizeBytes,
      speedMbps: 45.2,
      filePath: destPath,
    };
    this.tasks.set(modelId, task);
    this.notify(task);

    // Simulated high-speed chunked downloader with event dispatching
    let downloaded = 0;
    const chunkSize = Math.max(1024 * 1024 * 50, Math.floor(fileSizeBytes / 15));

    const interval = setInterval(() => {
      downloaded += chunkSize;
      if (downloaded >= fileSizeBytes) {
        downloaded = fileSizeBytes;
        clearInterval(interval);
        this.intervals.delete(modelId);

        task.status = 'completed';
        task.progressPercent = 100;
        task.downloadedBytes = fileSizeBytes;
        try {
          fs.writeFileSync(destPath, `GGUF_MOCK_HEADER_${modelId}`, 'utf-8');
        } catch {}
      } else {
        task.downloadedBytes = downloaded;
        task.progressPercent = Math.round((downloaded / fileSizeBytes) * 100);
      }
      this.tasks.set(modelId, { ...task });
      this.notify(task);
    }, 400);

    this.intervals.set(modelId, interval);
    return task;
  }
}
