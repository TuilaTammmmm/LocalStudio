import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import util from 'node:util';
import { HardwareMonitor } from './hardware.js';

const execAsync = util.promisify(exec);

export interface RuntimePackage {
  id: string;
  name: string;
  platform: 'win32' | 'darwin' | 'linux';
  arch: 'x64' | 'arm64';
  hardware: 'cuda' | 'metal' | 'vulkan' | 'cpu';
  downloadUrl: string;
  sizeBytes: number;
  description: string;
}

export interface EngineStatus {
  installed: boolean;
  binaryPath: string | null;
  platform: string;
  arch: string;
  recommendedRuntimeId: string;
  installedRuntimeId?: string;
  downloadInProgress: boolean;
  downloadProgress: number;
  statusMessage?: string;
}

// Official high-speed GitHub releases of llama.cpp pre-built binaries
const RUNTIME_MANIFEST: Record<string, RuntimePackage> = {
  'win-cuda12': {
    id: 'win-cuda12',
    name: 'Windows NVIDIA CUDA 12.x',
    platform: 'win32',
    arch: 'x64',
    hardware: 'cuda',
    downloadUrl: 'https://github.com/ggml-org/llama.cpp/releases/download/b4600/llama-b4600-bin-win-cuda-cu12.4-x64.zip',
    sizeBytes: 420000000,
    description: 'Tăng tốc phần cứng tối đa bằng GPU NVIDIA (CUDA 12.x) trên Windows 10/11 x64',
  },
  'win-vulkan': {
    id: 'win-vulkan',
    name: 'Windows Vulkan (AMD / Intel GPU)',
    platform: 'win32',
    arch: 'x64',
    hardware: 'vulkan',
    downloadUrl: 'https://github.com/ggml-org/llama.cpp/releases/download/b4600/llama-b4600-bin-win-vulkan-x64.zip',
    sizeBytes: 38000000,
    description: 'Tăng tốc GPU đa năng cho card đồ họa AMD Radeon và Intel Arc qua Vulkan',
  },
  'win-cpu': {
    id: 'win-cpu',
    name: 'Windows CPU AVX2',
    platform: 'win32',
    arch: 'x64',
    hardware: 'cpu',
    downloadUrl: 'https://github.com/ggml-org/llama.cpp/releases/download/b4600/llama-b4600-bin-win-avx2-x64.zip',
    sizeBytes: 28000000,
    description: 'Chạy trực tiếp bằng CPU Intel / AMD (hỗ trợ tập lệnh tăng tốc AVX2)',
  },
  'mac-arm64-metal': {
    id: 'mac-arm64-metal',
    name: 'macOS Apple Silicon (Metal)',
    platform: 'darwin',
    arch: 'arm64',
    hardware: 'metal',
    downloadUrl: 'https://github.com/ggml-org/llama.cpp/releases/download/b4600/llama-b4600-bin-macos-arm64.zip',
    sizeBytes: 35000000,
    description: 'Tối ưu siêu tốc cho chip Apple M1/M2/M3/M4 với Apple Metal và Unified Memory',
  },
  'mac-x64-metal': {
    id: 'mac-x64-metal',
    name: 'macOS Intel (x64)',
    platform: 'darwin',
    arch: 'x64',
    hardware: 'metal',
    downloadUrl: 'https://github.com/ggml-org/llama.cpp/releases/download/b4600/llama-b4600-bin-macos-x64.zip',
    sizeBytes: 32000000,
    description: 'Hỗ trợ các dòng máy Mac đời cũ sử dụng vi xử lý Intel x86_64',
  },
  'linux-cuda': {
    id: 'linux-cuda',
    name: 'Linux NVIDIA CUDA',
    platform: 'linux',
    arch: 'x64',
    hardware: 'cuda',
    downloadUrl: 'https://github.com/ggml-org/llama.cpp/releases/download/b4600/llama-b4600-bin-ubuntu-x64.zip',
    sizeBytes: 150000000,
    description: 'Tăng tốc GPU NVIDIA CUDA trên môi trường Linux Ubuntu / Debian x64',
  },
  'linux-cpu': {
    id: 'linux-cpu',
    name: 'Linux CPU AVX2',
    platform: 'linux',
    arch: 'x64',
    hardware: 'cpu',
    downloadUrl: 'https://github.com/ggml-org/llama.cpp/releases/download/b4600/llama-b4600-bin-ubuntu-x64.zip',
    sizeBytes: 60000000,
    description: 'Chạy thuần CPU đa nhân trên các bản phân phối Linux',
  },
};

export interface DiscoveredEngine {
  id: string;
  name: string;
  type: 'ollama' | 'lmstudio' | 'llama-server';
  binaryPath: string;
  baseUrl?: string;
  available: boolean;
}

export class RuntimeManager {
  private hardwareMonitor: HardwareMonitor;
  private isDownloading = false;
  private progressPercent = 0;
  private statusMessage = '';

  constructor() {
    this.hardwareMonitor = new HardwareMonitor();
  }

  /**
   * Get permanent runtime binaries directory based on OS
   */
  public getRuntimeDir(): string {
    const home = process.env.USERPROFILE || process.env.HOME || os.homedir() || 'C:\\';
    if (process.platform === 'win32') {
      return path.join(home, 'LocalAI', 'bin');
    }
    if (process.platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'LocalAI', 'bin');
    }
    return path.join(home, '.localai', 'bin');
  }

  /**
   * Check if llama-server binary is present and executable
   */
  public getInstalledBinary(): string | null {
    const isWin = process.platform === 'win32';
    const binaryName = isWin ? 'llama-server.exe' : 'llama-server';
    const home = process.env.USERPROFILE || process.env.HOME || os.homedir() || 'C:\\';

    const candidatePaths = [
      path.join(this.getRuntimeDir(), binaryName),
      path.resolve(process.cwd(), 'bin', binaryName),
      path.resolve(process.cwd(), binaryName),
      path.join(home, 'LocalAI', binaryName),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }

  /**
   * Automatically detect system profile and select the optimal engine runtime
   */
  public async detectRecommendedRuntime(): Promise<string> {
    const platform = process.platform;
    const arch = process.arch;

    if (platform === 'darwin') {
      return arch === 'arm64' ? 'mac-arm64-metal' : 'mac-x64-metal';
    }

    if (platform === 'win32') {
      const stats = await this.hardwareMonitor.getStats();
      if (stats.vramTotalMb > 1000 && !stats.gpuName.includes('CPU Only')) {
        return 'win-cuda12';
      }
      return 'win-cpu';
    }

    if (platform === 'linux') {
      const stats = await this.hardwareMonitor.getStats();
      if (stats.vramTotalMb > 1000 && !stats.gpuName.includes('CPU Only')) {
        return 'linux-cuda';
      }
      return 'linux-cpu';
    }

    return 'win-cpu';
  }

  /**
   * Get current engine status for client UI
   */
  public async getStatus(): Promise<EngineStatus> {
    const binary = this.getInstalledBinary();
    const recommendedId = await this.detectRecommendedRuntime();

    return {
      installed: binary !== null,
      binaryPath: binary,
      platform: process.platform,
      arch: process.arch,
      recommendedRuntimeId: recommendedId,
      downloadInProgress: this.isDownloading,
      downloadProgress: this.progressPercent,
      statusMessage: this.statusMessage || (binary ? 'Động cơ suy luận đã sẵn sàng' : 'Chưa cài đặt động cơ suy luận'),
    };
  }

  /**
   * Get all available runtime packages in manifest
   */
  public getManifest(): RuntimePackage[] {
    return Object.values(RUNTIME_MANIFEST);
  }

  /**
   * Download and extract runtime package into runtime directory
   */
  public async downloadAndInstall(
    runtimeId?: string,
    onProgress?: (progress: { percent: number; message: string }) => void
  ): Promise<{ success: boolean; binaryPath?: string; error?: string }> {
    if (this.isDownloading) {
      return { success: false, error: 'Đang có tiến trình tải engine khác đang chạy' };
    }

    const targetId = runtimeId || (await this.detectRecommendedRuntime());
    const pkg = RUNTIME_MANIFEST[targetId];
    if (!pkg) {
      return { success: false, error: `Không tìm thấy gói runtime: ${targetId}` };
    }

    this.isDownloading = true;
    this.progressPercent = 0;
    this.statusMessage = `Đang kết nối tới máy chủ tải ${pkg.name}...`;

    const targetDir = this.getRuntimeDir();
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const tempZipPath = path.join(targetDir, `temp_engine_${Date.now()}.zip`);

    try {
      this.statusMessage = `Đang tải ${pkg.name}...`;
      onProgress?.({ percent: 5, message: this.statusMessage });

      const res = await fetch(pkg.downloadUrl, {
        headers: { 'User-Agent': 'LocalAI-Studio-Client' },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const contentLength = parseInt(res.headers.get('content-length') || '0', 10) || pkg.sizeBytes;
      const fileStream = fs.createWriteStream(tempZipPath);

      let downloadedBytes = 0;
      const reader = res.body?.getReader();
      if (!reader) throw new Error('Không thể khởi tạo stream tải dữ liệu');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          fileStream.write(Buffer.from(value));
          downloadedBytes += value.length;
          const pct = Math.min(90, Math.round((downloadedBytes / contentLength) * 85) + 5);
          this.progressPercent = pct;
          this.statusMessage = `Đang tải ${pkg.name} (${Math.round(downloadedBytes / (1024 * 1024))}MB / ${Math.round(contentLength / (1024 * 1024))}MB)...`;
          onProgress?.({ percent: pct, message: this.statusMessage });
        }
      }

      await new Promise<void>((resolve, reject) => {
        fileStream.end(() => resolve());
        fileStream.on('error', reject);
      });

      this.progressPercent = 92;
      this.statusMessage = 'Đang giải nén động cơ suy luận...';
      onProgress?.({ percent: 92, message: this.statusMessage });

      // Extract archive based on platform
      if (process.platform === 'win32') {
        const extractCmd = `powershell -NoProfile -Command "Expand-Archive -Path '${tempZipPath}' -DestinationPath '${targetDir}' -Force"`;
        await execAsync(extractCmd);
      } else {
        await execAsync(`unzip -o "${tempZipPath}" -d "${targetDir}"`);
        // Grant execute permissions on Unix
        const binName = 'llama-server';
        const binFile = path.join(targetDir, binName);
        if (fs.existsSync(binFile)) {
          fs.chmodSync(binFile, 0o755);
        }
      }

      // Cleanup temp zip
      if (fs.existsSync(tempZipPath)) {
        try {
          fs.unlinkSync(tempZipPath);
        } catch {}
      }

      const binaryPath = this.getInstalledBinary();
      if (!binaryPath) {
        throw new Error('Giải nén hoàn tất nhưng không tìm thấy file llama-server executable');
      }

      this.progressPercent = 100;
      this.statusMessage = 'Cài đặt động cơ suy luận thành công!';
      onProgress?.({ percent: 100, message: this.statusMessage });

      return { success: true, binaryPath };
    } catch (err: any) {
      this.statusMessage = `Lỗi tải engine: ${err.message}`;
      if (fs.existsSync(tempZipPath)) {
        try {
          fs.unlinkSync(tempZipPath);
        } catch {}
      }
      return { success: false, error: err.message };
    } finally {
      this.isDownloading = false;
    }
  }

  /**
   * Scan system for locally installed engines (Ollama, LM Studio, local llama-server)
   */
  public discoverExternalEngines(): DiscoveredEngine[] {
    const list: DiscoveredEngine[] = [];
    const isWin = process.platform === 'win32';
    const home = process.env.USERPROFILE || process.env.HOME || os.homedir() || 'C:\\';

    // 1. Ollama discovery
    const ollamaCandidates = isWin
      ? [
          path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Programs', 'Ollama', 'ollama.exe'),
          path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Ollama', 'ollama.exe'),
        ]
      : ['/usr/local/bin/ollama', '/usr/bin/ollama', path.join(home, '.ollama', 'bin', 'ollama')];

    for (const p of ollamaCandidates) {
      if (fs.existsSync(p)) {
        list.push({
          id: 'ext-ollama',
          name: 'Ollama Engine',
          type: 'ollama',
          binaryPath: p,
          baseUrl: 'http://127.0.0.1:11434',
          available: true,
        });
        break;
      }
    }

    // 2. LM Studio discovery
    const lmStudioCandidates = isWin
      ? [
          path.join(home, '.cache', 'lm-studio', 'bin', 'llama-server.exe'),
          path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'LM-Studio', 'app', 'bin', 'llama-server.exe'),
        ]
      : [
          path.join(home, '.cache', 'lm-studio', 'bin', 'llama-server'),
          path.join(home, 'Library', 'Application Support', 'LM Studio', 'bin', 'llama-server'),
        ];

    for (const p of lmStudioCandidates) {
      if (fs.existsSync(p)) {
        list.push({
          id: 'ext-lmstudio',
          name: 'LM Studio Runtime',
          type: 'lmstudio',
          binaryPath: p,
          baseUrl: 'http://127.0.0.1:1234/v1',
          available: true,
        });
        break;
      }
    }

    // 3. Local bundled or existing llama-server in bin/
    const bundledCandidate = path.resolve(process.cwd(), 'bin', isWin ? 'llama-server.exe' : 'llama-server');
    if (fs.existsSync(bundledCandidate)) {
      list.push({
        id: 'local-bundled',
        name: 'Local Bundled llama-server',
        type: 'llama-server',
        binaryPath: bundledCandidate,
        available: true,
      });
    }

    return list;
  }

  /**
   * Import an offline engine archive (.zip) or directory/binary into LocalAI runtime directory
   */
  public async importOfflineEngine(sourcePath: string): Promise<{ success: boolean; binaryPath?: string; error?: string }> {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: 'Đường dẫn nguồn không tồn tại trên máy.' };
    }

    const targetDir = this.getRuntimeDir();
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const isWin = process.platform === 'win32';
    const binaryName = isWin ? 'llama-server.exe' : 'llama-server';

    try {
      const stat = fs.statSync(sourcePath);
      if (stat.isFile() && sourcePath.endsWith('.zip')) {
        if (isWin) {
          const extractCmd = `powershell -NoProfile -Command "Expand-Archive -Path '${sourcePath}' -DestinationPath '${targetDir}' -Force"`;
          await execAsync(extractCmd);
        } else {
          await execAsync(`unzip -o "${sourcePath}" -d "${targetDir}"`);
          const binFile = path.join(targetDir, binaryName);
          if (fs.existsSync(binFile)) fs.chmodSync(binFile, 0o755);
        }
      } else if (stat.isDirectory()) {
        const files = fs.readdirSync(sourcePath);
        for (const f of files) {
          const srcFile = path.join(sourcePath, f);
          const destFile = path.join(targetDir, f);
          if (fs.statSync(srcFile).isFile()) {
            fs.copyFileSync(srcFile, destFile);
          }
        }
        if (!isWin) {
          const binFile = path.join(targetDir, binaryName);
          if (fs.existsSync(binFile)) fs.chmodSync(binFile, 0o755);
        }
      } else if (stat.isFile()) {
        const destFile = path.join(targetDir, path.basename(sourcePath));
        fs.copyFileSync(sourcePath, destFile);
        if (!isWin) fs.chmodSync(destFile, 0o755);
      }

      const installed = this.getInstalledBinary();
      if (!installed) {
        return {
          success: false,
          error: `Đã nhập tệp nhưng không tìm thấy tệp thực thi '${binaryName}' trong thư mục runtime.`,
        };
      }

      return { success: true, binaryPath: installed };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
