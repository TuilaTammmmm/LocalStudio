import { WorkspaceFS } from '../src/workspace-fs.js';
import { ContextBuilder } from '../src/context-builder.js';

async function run() {
  console.log('Testing WorkspaceFS and ContextBuilder...');
  const root = process.cwd();

  // 1. Scan tree
  const tree = WorkspaceFS.getFileTree(root, 3);
  console.log(`Scanned tree items at root: ${tree.length}`);
  const hasSrc = tree.some((node) => node.name === 'src' && node.isDirectory);
  const hasPackage = tree.some((node) => node.name === 'package.json');

  if (!hasSrc || !hasPackage) {
    throw new Error('Tree scanner failed to find expected items');
  }

  // 2. Test context builder
  const context = ContextBuilder.buildContext(root, ['package.json', 'src/types.ts']);
  console.log(`Context loaded files: ${context.files.length}, Total estimated tokens: ${context.totalTokens}`);
  if (context.files.length !== 2) {
    throw new Error('Failed to load context files');
  }

  // 3. Test Path Traversal Protection
  if (!WorkspaceFS.isSafePath(root, 'src/types.ts')) {
    throw new Error('Valid workspace path was incorrectly rejected');
  }
  if (WorkspaceFS.isSafePath(root, '../../Windows/System32/calc.exe')) {
    throw new Error('Path traversal attack ../../ was not caught by isSafePath');
  }
  const trappedContext = ContextBuilder.buildContext(root, ['../../Windows/System32/calc.exe']);
  if (trappedContext.files.length !== 0 || trappedContext.warnings.length === 0) {
    throw new Error('ContextBuilder allowed directory traversal attack');
  }
  console.log('Path traversal protection verified: blocked unauthorized file access.');

  // 4. Test applyPatchOrFullContent
  // 4.1 Single SEARCH/REPLACE block
  const originalA = `function greet() {\n  console.log("hello world");\n  return true;\n}`;
  const patchSingle = `<<<<<<< SEARCH\n  console.log("hello world");\n=======\n  console.log("hello localai");\n>>>>>>> REPLACE`;
  const resultSingle = WorkspaceFS.applyPatchOrFullContent(originalA, patchSingle);
  if (!resultSingle.appliedAsPatch) {
    throw new Error('Expected appliedAsPatch to be true for single search/replace block');
  }
  if (!resultSingle.updatedContent.includes('hello localai') || resultSingle.updatedContent.includes('hello world')) {
    throw new Error('Single patch block was not applied correctly');
  }
  console.log('Single search/replace block patch verified.');

  // 4.2 Multiple SEARCH/REPLACE blocks
  const originalB = `const a = 10;\nconst b = 20;\nconst c = 30;`;
  const patchMultiple = `<<<<<<< SEARCH\nconst a = 10;\n=======\nconst a = 100;\n>>>>>>> REPLACE\n<<<<<<< SEARCH\nconst c = 30;\n=======\nconst c = 300;\n>>>>>>> REPLACE`;
  const resultMultiple = WorkspaceFS.applyPatchOrFullContent(originalB, patchMultiple);
  if (!resultMultiple.appliedAsPatch) {
    throw new Error('Expected appliedAsPatch to be true for multiple search/replace blocks');
  }
  if (resultMultiple.updatedContent !== `const a = 100;\nconst b = 20;\nconst c = 300;`) {
    throw new Error('Multiple patch blocks were not applied correctly');
  }
  console.log('Multiple search/replace blocks patch verified.');

  // 4.3 Normal full content fallback
  const originalC = `old content line 1\nold content line 2`;
  const fullContent = `completely rewritten new content`;
  const resultFallback = WorkspaceFS.applyPatchOrFullContent(originalC, fullContent);
  if (resultFallback.appliedAsPatch) {
    throw new Error('Expected appliedAsPatch to be false when no search/replace blocks exist');
  }
  if (resultFallback.updatedContent !== fullContent) {
    throw new Error('Full content fallback did not return exact replacement');
  }
  console.log('Full content fallback verified.');

  // 5. Test Offline RAG Search
  const ragResults = WorkspaceFS.searchWorkspaceRAG(root, 'applyPatchOrFullContent', 5);
  console.log(`RAG search found ${ragResults.length} matching snippets for "applyPatchOrFullContent".`);
  if (ragResults.length === 0) {
    throw new Error('RAG search failed to find snippets for "applyPatchOrFullContent"');
  }
  const topResult = ragResults[0];
  if (!topResult.snippet.includes('applyPatchOrFullContent')) {
    throw new Error('Top RAG search result snippet does not contain query term');
  }
  console.log('Offline RAG search verified.');

  console.log('✅ Phase 4 Workspace & File Tree Engine verification PASSED!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
