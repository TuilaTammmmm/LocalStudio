import fs from 'node:fs';
import path from 'node:path';
import { parseGgufHeader } from '../src/gguf-parser.js';
import { DatabaseService } from '../src/db.js';

console.log('Testing GGUF Parser & Multi-directory scanning...');

const tempDir = path.resolve(process.cwd(), '.temp_gguf_test');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

try {
  // 1. Test parsing invalid file
  const dummyFile = path.join(tempDir, 'dummy.txt');
  fs.writeFileSync(dummyFile, 'Not a GGUF file');
  const invalidResult = parseGgufHeader(dummyFile);
  if (invalidResult.valid !== false) {
    throw new Error('Expected invalid GGUF for dummy text file');
  }
  console.log('[GGUF Parser] Graceful fallback on non-GGUF files verified.');

  // 2. Synthesize a minimal valid GGUF header
  // Magic: 'GGUF' (4 bytes)
  // Version: 3 (uint32 = 4 bytes)
  // Tensor count: 120 (uint64 = 8 bytes)
  // Metadata KV count: 3 (uint64 = 8 bytes)
  const headerBuf = Buffer.alloc(1024);
  let offset = 0;

  // Magic
  headerBuf.write('GGUF', offset, 4, 'ascii');
  offset += 4;

  // Version 3
  headerBuf.writeUInt32LE(3, offset);
  offset += 4;

  // Tensor count: 120
  headerBuf.writeBigUInt64LE(120n, offset);
  offset += 8;

  // Metadata count: 3
  headerBuf.writeBigUInt64LE(3n, offset);
  offset += 8;

  // Helper to write string
  const writeGgufString = (str: string) => {
    const strBuf = Buffer.from(str, 'utf-8');
    headerBuf.writeBigUInt64LE(BigInt(strBuf.length), offset);
    offset += 8;
    strBuf.copy(headerBuf, offset);
    offset += strBuf.length;
  };

  // KV 1: "general.architecture" = "qwen2" (type 8 = string)
  writeGgufString('general.architecture');
  headerBuf.writeUInt32LE(8, offset); // STRING
  offset += 4;
  writeGgufString('qwen2');

  // KV 2: "qwen2.context_length" = 32768 (type 4 = uint32)
  writeGgufString('qwen2.context_length');
  headerBuf.writeUInt32LE(4, offset); // UINT32
  offset += 4;
  headerBuf.writeUInt32LE(32768, offset);
  offset += 4;

  // KV 3: "qwen2.block_count" = 28 (type 4 = uint32)
  writeGgufString('qwen2.block_count');
  headerBuf.writeUInt32LE(4, offset); // UINT32
  offset += 4;
  headerBuf.writeUInt32LE(28, offset);
  offset += 4;

  const validGgufPath = path.join(tempDir, 'mock_model.gguf');
  fs.writeFileSync(validGgufPath, headerBuf.subarray(0, offset));

  const parsed = parseGgufHeader(validGgufPath);
  console.log('[GGUF Parser] Parsed mock GGUF:', {
    valid: parsed.valid,
    arch: parsed.architecture,
    ctx: parsed.contextLength,
    layers: parsed.totalLayers,
    tensors: parsed.tensorCount,
  });

  if (
    !parsed.valid ||
    parsed.architecture !== 'qwen2' ||
    parsed.contextLength !== 32768 ||
    parsed.totalLayers !== 28 ||
    parsed.tensorCount !== 120
  ) {
    throw new Error('GGUF binary header parser failed to extract expected fields');
  }
  console.log('[GGUF Parser] Binary header extraction verified successfully.');

  // 3. Test Multi-directory Scanning in DatabaseService
  const testDbDir = path.join(tempDir, 'db');
  const customModelDir1 = path.join(tempDir, 'custom_models_1');
  const customModelDir2 = path.join(tempDir, 'custom_models_2');
  fs.mkdirSync(customModelDir1, { recursive: true });
  fs.mkdirSync(customModelDir2, { recursive: true });

  // Put a model in customModelDir2
  fs.writeFileSync(path.join(customModelDir2, 'extra_model.gguf'), 'GGUF dummy');

  const db = new DatabaseService(testDbDir);
  db.addCustomModelDir(customModelDir1);
  db.addCustomModelDir(customModelDir2);

  const customDirs = db.getCustomModelDirs();
  if (customDirs.length !== 2) throw new Error('Expected 2 custom model dirs');

  const allDirs = db.getAllModelDirs();
  if (!allDirs.includes(customModelDir1) || !allDirs.includes(customModelDir2)) {
    throw new Error('Expected custom model dirs in getAllModelDirs');
  }

  const localLlama = db.getProvider('local-llama');
  if (!localLlama?.models.includes('extra_model.gguf')) {
    throw new Error('Expected extra_model.gguf to be discovered across multi-directories');
  }
  console.log('[Multi-Directory Hub] Model discovery across multiple directories verified successfully.');

  db.close();
  console.log('✅ Phase 3 GGUF Parser & Multi-directory Verification PASSED!');
} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}
