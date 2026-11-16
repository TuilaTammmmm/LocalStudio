import { HardwareMonitor } from '../src/hardware.js';
import { LlamaProcessManager } from '../src/llama-process.js';

async function run() {
  console.log('Testing HardwareMonitor...');
  const monitor = new HardwareMonitor();
  const stats = await monitor.getStats();

  console.log(`Detected GPU: ${stats.gpuName}`);
  console.log(`VRAM Total: ${stats.vramTotalMb} MB, Free: ${stats.vramFreeMb} MB, Used: ${stats.vramUsedMb} MB`);
  console.log(`System RAM Total: ${stats.ramTotalMb} MB, Free: ${stats.ramFreeMb} MB`);

  // Test smart offload calculation for 3B and 8B models
  const offload3B = monitor.calculateSmartOffload(stats, '3B');
  console.log(`Offload 3B Model: -ngl ${offload3B.ngl}, Context: ${offload3B.recommendedContext}, Strategy: ${offload3B.strategy}`);

  const offload8B = monitor.calculateSmartOffload(stats, '8B');
  console.log(`Offload 8B Model: -ngl ${offload8B.ngl}, Context: ${offload8B.recommendedContext}, Strategy: ${offload8B.strategy}`);

  if (stats.vramTotalMb > 0 && offload8B.ngl <= 0) {
    throw new Error('Expected positive GPU layers for GTX 1650');
  }

  // Test process manager status structure
  const manager = new LlamaProcessManager();
  const status = manager.getStatus();
  console.log(`LlamaProcessManager initial status: running = ${status.isRunning}`);

  console.log('✅ Phase 2 Hardware & Process Manager verification PASSED!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
