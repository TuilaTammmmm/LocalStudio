import { RustTokenizerService } from '../src/rust-tokenizer.js';
import path from 'node:path';
import fs from 'node:fs';

async function runTest() {
  console.log('Testing RustTokenizerService...');

  // 1. Locate binary
  const binPath = RustTokenizerService.findBinaryPath();
  console.log('Found Rust tokenizer binary:', binPath);
  if (!binPath) {
    throw new Error('Rust tokenizer binary not found!');
  }

  // 2. Fallback heuristic when no tokenizer loaded
  const fallbackRes = await RustTokenizerService.tokenize('Hello world test', {});
  console.log('Fallback tokenization result:', fallbackRes);
  if (fallbackRes.count <= 0) {
    throw new Error('Fallback tokenization failed!');
  }

  // 3. Test with real tokenizer.json
  const testTokenizerPath = path.join(process.cwd(), 'test', 'gpt2_tokenizer.json');
  if (fs.existsSync(testTokenizerPath)) {
    const loaded = await RustTokenizerService.loadTokenizer(testTokenizerPath);
    console.log('Loaded test tokenizer with Rust:', loaded);
    if (!loaded) {
      throw new Error('Failed to load test tokenizer in Rust daemon!');
    }

    const encodeRes = await RustTokenizerService.tokenize('Hello world from Rust', { tokenizerPath: testTokenizerPath });
    console.log('Rust encode result:', encodeRes);
    if (encodeRes.engine !== 'rust' || encodeRes.tokens.length !== 4) {
      throw new Error(`Unexpected encode result: ${JSON.stringify(encodeRes)}`);
    }

    console.log('✅ Rust Tokenizer Test with Real Vocab PASSED!');
  }

  // 4. Test Rust-accelerated RAG search
  const ragRes = await RustTokenizerService.searchRAG(process.cwd(), 'applyPatchOrFullContent', 3);
  console.log('Rust RAG search result count:', ragRes.results.length, 'Engine:', ragRes.engine);
  if (ragRes.engine !== 'rust' || ragRes.results.length === 0) {
    throw new Error('Rust RAG search failed to find snippets!');
  }
  if (!ragRes.results[0].snippet.includes('applyPatchOrFullContent')) {
    throw new Error('Rust RAG snippet does not contain query string!');
  }
  console.log('✅ Rust RAG Search Test PASSED!');

  RustTokenizerService.dispose();
  console.log('✅ All RustTokenizerService tests completed successfully!');
}

runTest().catch((err) => {
  console.error('❌ Rust Tokenizer Test FAILED:', err);
  RustTokenizerService.dispose();
  process.exit(1);
});
