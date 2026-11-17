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
   * Calculate smart -ngl (GPU offloaded layers) and CPU threads for ANY hardware.
   * Dynamically auto-scales from low-end GPUs (GTX 1650 4GB) to high-end cards (RTX 3060/4070/4090 12-24GB)
   * and aligns CPU thread count with physical cores per llama.cpp official recommendations.
   */
  public calculateSmartOffload(
    stats: HardwareStats,
    modelType: '1.5B' | '3B' | '7B' | '8B' | '14B' | '32B' | 'unknown' = '8B'
  ): {
    ngl: number;
    threads: number;
    recommendedContext: number;
    strategy: string;
  } {
    // Official llama.cpp guidance: Use physical core count, not logical/SMT threads
    const logicalCores = os.cpus().length;
    const physicalCores = Math.max(2, Math.floor(logicalCores / 2));
    const cpuThreads = Math.min(8, physicalCores);

    if (stats.vramTotalMb === 0) {
      return {
        ngl: 0,
        threads: cpuThreads,
        recommendedContext: 4096,
        strategy: '100% CPU Execution (No GPU available)',
      };
    }

    // Dynamic OS & Display Safety Buffer: 800MB for <=6GB GPUs, 1200MB for >=12GB GPUs
    const safetyBufferMb = stats.vramTotalMb <= 6000 ? 800 : 1200;
    const usableVramMb = Math.max(0, stats.vramFreeMb - safetyBufferMb);

    // Approximate memory requirements per model parameter tier (Q4_K_M quant + KV cache)
    const tierConfig: Record<string, { layers: number; mbPerLayer: number; fullGpuMb: number }> = {
      '1.5B': { layers: 28, mbPerLayer: 45, fullGpuMb: 1800 },
      '3B': { layers: 28, mbPerLayer: 80, fullGpuMb: 2800 },
      '7B': { layers: 32, mbPerLayer: 145, fullGpuMb: 5200 },
      '8B': { layers: 32, mbPerLayer: 155, fullGpuMb: 5600 },
      '14B': { layers: 48, mbPerLayer: 195, fullGpuMb: 10200 },
      '32B': { layers: 64, mbPerLayer: 320, fullGpuMb: 22000 },
      'unknown': { layers: 32, mbPerLayer: 150, fullGpuMb: 5400 },
    };

    const target = tierConfig[modelType] || tierConfig['8B'];

    // High-end hardware check: If usable VRAM fits the entire model + KV cache
    if (usableVramMb >= target.fullGpuMb) {
      const recContext = stats.vramTotalMb >= 12000 ? 16384 : 8192;
      return {
        ngl: 99, // 100% Full GPU offload
        threads: Math.min(4, cpuThreads),
        recommendedContext: recContext,
        strategy: `100% GPU Offload (${stats.gpuName}, ~${target.fullGpuMb}MB VRAM, Cực nhanh ~50-120 t/s)`,
      };
    }

    // Mid-range & Budget hardware: Calculate exact safe offload layers without OOM
    const safeGpuLayers = Math.max(0, Math.min(target.layers, Math.floor(usableVramMb / target.mbPerLayer)));
    const cpuLayers = target.layers - safeGpuLayers;

    if (safeGpuLayers >= target.layers) {
      return {
        ngl: 99,
        threads: Math.min(4, cpuThreads),
        recommendedContext: 8192,
        strategy: `100% GPU Offload (${stats.gpuName}, ~${safeGpuLayers * target.mbPerLayer}MB VRAM)`,
      };
    }

    if (safeGpuLayers === 0) {
      return {
        ngl: 0,
        threads: cpuThreads,
        recommendedContext: 4096,
        strategy: `100% CPU Execution (VRAM khả dụng ${usableVramMb}MB không đủ cho layer GPU)`,
      };
    }

    return {
      ngl: safeGpuLayers,
      threads: cpuThreads,
      recommendedContext: 4096,
      strategy: `Hybrid: ${safeGpuLayers}/${target.layers} layers trên GPU CUDA (~${safeGpuLayers * target.mbPerLayer}MB VRAM), ${cpuLayers} layers trên CPU+RAM (~10-25 t/s)`,
    };
  }
}
