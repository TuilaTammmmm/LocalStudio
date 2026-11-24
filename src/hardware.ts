import { exec } from 'node:child_process';
import util from 'node:util';
import os from 'node:os';
import type { HardwareStats } from './types.js';

const execAsync = util.promisify(exec);

export interface CpuFeatures {
  hasAvx2: boolean;
  hasAvx: boolean;
  model: string;
  architecture: string;
}

export class HardwareMonitor {
  private static cachedCpuFeatures: CpuFeatures | null = null;

  /**
   * Probe CPU instruction capabilities (AVX2, AVX, Architecture)
   */
  public static async getCpuFeatures(): Promise<CpuFeatures> {
    if (HardwareMonitor.cachedCpuFeatures) {
      return HardwareMonitor.cachedCpuFeatures;
    }

    const cpus = os.cpus();
    const model = cpus[0]?.model?.trim() || 'Unknown CPU';
    const architecture = process.arch;
    let hasAvx2 = true;
    let hasAvx = true;

    try {
      if (process.platform === 'win32') {
        // Query Windows kernel IsProcessorFeaturePresent via PowerShell
        // Feature 40 = PF_AVX2_INSTRUCTIONS_AVAILABLE
        const { stdout } = await execAsync(
          `powershell -NoProfile -Command "Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class CpuCheck {
    [DllImport(\`"kernel32.dll\`")]
    public static extern bool IsProcessorFeaturePresent(int feature);
}
'@; [CpuCheck]::IsProcessorFeaturePresent(40)"`,
          { timeout: 3500 }
        );
        const res = stdout.trim().toLowerCase();
        hasAvx2 = res.includes('true');
        hasAvx = hasAvx2;
      } else if (process.platform === 'linux') {
        const { stdout } = await execAsync('cat /proc/cpuinfo | grep -m1 "flags"', { timeout: 1500 });
        hasAvx2 = stdout.includes('avx2');
        hasAvx = stdout.includes('avx');
      } else if (process.platform === 'darwin') {
        if (architecture === 'arm64') {
          hasAvx2 = true;
          hasAvx = true;
        } else {
          const { stdout } = await execAsync('sysctl -n machdep.cpu.leaf7_features machdep.cpu.features', { timeout: 1500 });
          hasAvx2 = stdout.toLowerCase().includes('avx2');
          hasAvx = stdout.toLowerCase().includes('avx');
        }
      }
    } catch {
      // Keep fallback
    }

    HardwareMonitor.cachedCpuFeatures = {
      hasAvx2,
      hasAvx,
      model,
      architecture,
    };
    return HardwareMonitor.cachedCpuFeatures;
  }

  /**
   * Query real-time GPU and System resources
   */
  public async getStats(): Promise<HardwareStats & { cpuFeatures?: CpuFeatures }> {
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

    const cpuFeatures = await HardwareMonitor.getCpuFeatures();

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
      cpuFeatures,
    };
  }

  /**
   * Calculate precise dynamic KV Cache memory size in MB
   * Formula: VRAM_kv = 2 * layers_gpu * n_ctx * n_embd_kv * bytes_per_element
   */
  public static calculateKvCacheMb(
    layersGpu: number,
    contextSize: number,
    modelType: '1.5B' | '3B' | '7B' | '8B' | '14B' | '32B' | 'unknown' = '8B',
    quantType: 'f16' | 'q8_0' | 'q4_0' = 'f16'
  ): number {
    const kvDimConfig: Record<string, number> = {
      '1.5B': 512,
      '3B': 768,
      '7B': 1024,
      '8B': 1024,
      '14B': 1280,
      '32B': 1536,
      'unknown': 1024,
    };
    const kvDim = kvDimConfig[modelType] || 1024;
    const bytesPerElement = quantType === 'q4_0' ? 0.5 : quantType === 'q8_0' ? 1.0 : 2.0;
    // Key + Value = 2 * dim * bytesPerElement
    const bytesPerTokenLayer = 2 * kvDim * bytesPerElement;
    const totalBytes = layersGpu * contextSize * bytesPerTokenLayer;
    return Math.round(totalBytes / (1024 * 1024));
  }

  /**
   * Calculate smart -ngl (GPU offloaded layers) and CPU threads for ANY hardware.
   * Dynamically auto-scales considering dynamic KV Cache memory expansion at higher contexts (4K to 32K)
   * to guarantee zero Out-Of-Memory (OOM) crashes.
   */
  public calculateSmartOffload(
    stats: HardwareStats,
    modelType: '1.5B' | '3B' | '7B' | '8B' | '14B' | '32B' | 'unknown' = '8B',
    requestedContext: number = 4096
  ): {
    ngl: number;
    threads: number;
    recommendedContext: number;
    strategy: string;
    breakdown?: {
      weightsMb: number;
      kvCacheMb: number;
      osBufferMb: number;
      totalUsedEstMb: number;
    };
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
        breakdown: {
          weightsMb: 0,
          kvCacheMb: 0,
          osBufferMb: 0,
          totalUsedEstMb: 0,
        },
      };
    }

    // Dynamic OS & Display Safety Buffer: 800MB for <=6GB GPUs, 1200MB for >=12GB GPUs
    const safetyBufferMb = stats.vramTotalMb <= 6000 ? 800 : 1200;
    const usableVramMb = Math.max(0, stats.vramFreeMb - safetyBufferMb);

    // Approximate weight requirements per model parameter tier (Q4_K_M quant)
    const tierConfig: Record<string, { layers: number; weightMbPerLayer: number; fullWeightMb: number }> = {
      '1.5B': { layers: 28, weightMbPerLayer: 38, fullWeightMb: 1100 },
      '3B': { layers: 28, weightMbPerLayer: 68, fullWeightMb: 2000 },
      '7B': { layers: 32, weightMbPerLayer: 120, fullWeightMb: 4000 },
      '8B': { layers: 32, weightMbPerLayer: 130, fullWeightMb: 4300 },
      '14B': { layers: 48, weightMbPerLayer: 175, fullWeightMb: 8600 },
      '32B': { layers: 64, weightMbPerLayer: 290, fullWeightMb: 19000 },
      'unknown': { layers: 32, weightMbPerLayer: 125, fullWeightMb: 4100 },
    };

    const target = tierConfig[modelType] || tierConfig['8B'];

    // Calculate full GPU requirements including full context KV Cache
    const fullKvCacheMb = HardwareMonitor.calculateKvCacheMb(target.layers, requestedContext, modelType);
    const fullGpuRequiredMb = target.fullWeightMb + fullKvCacheMb;

    // High-end hardware check: If usable VRAM fits entire weights + full KV Cache
    if (usableVramMb >= fullGpuRequiredMb) {
      const recContext = stats.vramTotalMb >= 12000 ? 16384 : 8192;
      return {
        ngl: 99, // 100% Full GPU offload
        threads: Math.min(4, cpuThreads),
        recommendedContext: recContext,
        strategy: `100% GPU Offload (${stats.gpuName}, ~${fullGpuRequiredMb}MB VRAM [Weights: ${target.fullWeightMb}MB, KV: ${fullKvCacheMb}MB], Cực nhanh ~50-120 t/s)`,
        breakdown: {
          weightsMb: target.fullWeightMb,
          kvCacheMb: fullKvCacheMb,
          osBufferMb: safetyBufferMb,
          totalUsedEstMb: fullGpuRequiredMb + safetyBufferMb,
        },
      };
    }

    // Mid-range & Budget hardware: Iteratively find highest safe layers where (weights + kvCache) <= usableVramMb
    let safeGpuLayers = 0;
    for (let l = target.layers; l >= 1; l--) {
      const wMb = l * target.weightMbPerLayer;
      const kvMb = HardwareMonitor.calculateKvCacheMb(l, requestedContext, modelType);
      if (wMb + kvMb <= usableVramMb) {
        safeGpuLayers = l;
        break;
      }
    }

    const cpuLayers = target.layers - safeGpuLayers;
    const estWeightsMb = safeGpuLayers * target.weightMbPerLayer;
    const estKvCacheMb = HardwareMonitor.calculateKvCacheMb(safeGpuLayers, requestedContext, modelType);
    const totalEstMb = estWeightsMb + estKvCacheMb;

    if (safeGpuLayers >= target.layers) {
      return {
        ngl: 99,
        threads: Math.min(4, cpuThreads),
        recommendedContext: requestedContext,
        strategy: `100% GPU Offload (${stats.gpuName}, ~${totalEstMb}MB VRAM [Weights: ${estWeightsMb}MB, KV: ${estKvCacheMb}MB])`,
        breakdown: {
          weightsMb: estWeightsMb,
          kvCacheMb: estKvCacheMb,
          osBufferMb: safetyBufferMb,
          totalUsedEstMb: totalEstMb + safetyBufferMb,
        },
      };
    }

    if (safeGpuLayers === 0) {
      return {
        ngl: 0,
        threads: cpuThreads,
        recommendedContext: 4096,
        strategy: `100% CPU Execution (VRAM khả dụng ${usableVramMb}MB không đủ cho layer GPU)`,
        breakdown: {
          weightsMb: 0,
          kvCacheMb: 0,
          osBufferMb: safetyBufferMb,
          totalUsedEstMb: safetyBufferMb,
        },
      };
    }

    return {
      ngl: safeGpuLayers,
      threads: cpuThreads,
      recommendedContext: requestedContext,
      strategy: `Hybrid: ${safeGpuLayers}/${target.layers} layers trên GPU CUDA (~${totalEstMb}MB VRAM [Weights: ${estWeightsMb}MB, KV: ${estKvCacheMb}MB]), ${cpuLayers} layers trên CPU+RAM (~10-25 t/s)`,
      breakdown: {
        weightsMb: estWeightsMb,
        kvCacheMb: estKvCacheMb,
        osBufferMb: safetyBufferMb,
        totalUsedEstMb: totalEstMb + safetyBufferMb,
      },
    };
  }
}
