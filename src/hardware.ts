import { exec } from 'node:child_process';
import util from 'node:util';
import os from 'node:os';
import type { HardwareStats } from './types.js';

const execAsync = util.promisify(exec);

export class HardwareMonitor {
  /**
   * Query real-time GPU and System resources
   */
  public async getStats(): Promise<HardwareStats> {
    const ramTotalMb = Math.round(os.totalmem() / (1024 * 1024));
    const ramFreeMb = Math.round(os.freemem() / (1024 * 1024));
    const ramUsedMb = ramTotalMb - ramFreeMb;

    let gpuName = 'CPU Only (No NVIDIA GPU detected)';
    let vramTotalMb = 0;
    let vramUsedMb = 0;
    let vramFreeMb = 0;
    let gpuUtilPercent = 0;

    try {
      // Query nvidia-smi with CSV output for precise parsing
      const { stdout } = await execAsync(
        'nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu --format=csv,noheader,nounits'
      );

      const parts = stdout.trim().split(',').map((p) => p.trim());
      if (parts.length >= 5) {
        gpuName = parts[0];
        vramTotalMb = parseInt(parts[1], 10) || 0;
        vramUsedMb = parseInt(parts[2], 10) || 0;
        vramFreeMb = parseInt(parts[3], 10) || 0;
        gpuUtilPercent = parseInt(parts[4], 10) || 0;
      }
    } catch {
      // Fallback if nvidia-smi is not available
    }

    const cpus = os.cpus();
    let cpuPercent = 0;
    if (cpus.length > 0) {
      let totalIdle = 0;
      let totalTick = 0;
      for (const cpu of cpus) {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
      }
      cpuPercent = Math.round((1 - totalIdle / totalTick) * 100);
    }

    return {
      gpuName,
      vramTotalMb,
      vramUsedMb,
      vramFreeMb,
      gpuUtilPercent,
      cpuPercent,
      ramTotalMb,
      ramUsedMb,
      ramFreeMb,
    };
  }

  /**
   * Calculate smart -ngl (GPU offloaded layers) and CPU threads for GTX 1650 (4GB)
   * Prevents CUDA Out Of Memory (OOM) by reserving an OS Display Safety Buffer.
   */
  public calculateSmartOffload(
    stats: HardwareStats,
    modelType: '1.5B' | '3B' | '7B' | '8B' | '14B' | 'unknown' = '8B'
  ): {
    ngl: number;
    threads: number;
    recommendedContext: number;
    strategy: string;
  } {
    const cpuThreads = Math.max(2, Math.min(6, os.cpus().length - 1));

    if (stats.vramTotalMb === 0) {
      return {
        ngl: 0,
        threads: cpuThreads,
        recommendedContext: 2048,
        strategy: '100% CPU Execution (No GPU available)',
      };
    }

    // 1000MB OS & Display Safety Buffer
    const safetyBufferMb = 1000;
    const usableVramMb = Math.max(0, stats.vramFreeMb - safetyBufferMb);

    if (modelType === '1.5B' || modelType === '3B') {
      return {
        ngl: 99, // Offload all layers to GPU
        threads: 2,
        recommendedContext: 8192,
        strategy: `100% GPU Offload (~${Math.min(2500, stats.vramFreeMb)}MB VRAM, Ultra Fast ~40-60 t/s)`,
      };
    }

    if (modelType === '7B' || modelType === '8B') {
      // 7B/8B typically has 32-33 layers.
      // In Q4_K_M quant, each layer takes ~125MB VRAM.
      const maxGpuLayers = 32;
      const safeGpuLayers = Math.max(0, Math.min(maxGpuLayers, Math.floor(usableVramMb / 125)));
      const cpuLayers = maxGpuLayers - safeGpuLayers;

      return {
        ngl: safeGpuLayers,
        threads: cpuThreads,
        recommendedContext: 4096,
        strategy: `Hybrid: ${safeGpuLayers} layers on CUDA GPU (~${safeGpuLayers * 125}MB VRAM), ${cpuLayers} layers on CPU+RAM (~8-14 t/s)`,
      };
    }

    // 14B or larger
    return {
      ngl: Math.max(0, Math.min(10, Math.floor(usableVramMb / 160))),
      threads: cpuThreads,
      recommendedContext: 2048,
      strategy: 'Heavy CPU Offload (Model exceeds 4GB VRAM capacity)',
    };
  }
}
