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

  console.log('✅ Phase 4 Workspace & File Tree Engine verification PASSED!');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
