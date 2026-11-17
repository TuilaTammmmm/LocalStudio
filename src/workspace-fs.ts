import fs from 'node:fs';
import path from 'node:path';

export interface FileNode {
  name: string;
  path: string; // Absolute path
  relativePath: string; // Relative to workspace root
  isDirectory: boolean;
  size?: number;
  children?: FileNode[];
}

const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.data',
  '.data_test',
  '.data_router_test',
  '__pycache__',
  '.vscode',
  '.idea',
  '.next',
]);

const BINARY_EXTENSIONS = new Set([
  '.exe', '.dll', '.bin', '.gguf', '.iso', '.zip', '.tar', '.gz',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.mp4',
  '.mp3', '.wav', '.woff', '.woff2', '.ttf', '.eot'
]);

export class WorkspaceFS {
  /**
   * Validates that targetPath is strictly inside workspaceRoot.
   * Protects against directory traversal attacks (../, absolute paths outside root, junction points).
   */
  public static isSafePath(workspaceRoot: string, targetPath: string): boolean {
    if (!workspaceRoot || !targetPath) return false;
    try {
      const resolvedRoot = path.resolve(workspaceRoot);
      const resolvedTarget = path.isAbsolute(targetPath)
        ? path.resolve(targetPath)
        : path.resolve(resolvedRoot, targetPath);
      const relative = path.relative(resolvedRoot, resolvedTarget);
      return !relative.startsWith('..') && !path.isAbsolute(relative);
    } catch {
      return false;
    }
  }

  /**
   * Safely resolves a path within workspace root, throwing an error if it traverses outside.
   */
  public static resolveSafePath(workspaceRoot: string, targetPath: string): string {
    if (!this.isSafePath(workspaceRoot, targetPath)) {
      throw new Error(`Security Violation: Path traversal outside workspace boundary (${targetPath})`);
    }
    const resolvedRoot = path.resolve(workspaceRoot);
    return path.isAbsolute(targetPath)
      ? path.resolve(targetPath)
      : path.resolve(resolvedRoot, targetPath);
  }

  /**
   * Scan folder tree recursively with ignore list
   */
  public static getFileTree(
    rootPath: string,
    maxDepth = 6,
    currentDepth = 0
  ): FileNode[] {
    if (!fs.existsSync(rootPath) || currentDepth >= maxDepth) {
      return [];
    }

    const items: FileNode[] = [];
    try {
      const entries = fs.readdirSync(rootPath, { withFileTypes: true });

      for (const entry of entries) {
        if (DEFAULT_IGNORED_DIRS.has(entry.name)) {
          continue;
        }

        const fullPath = path.join(rootPath, entry.name);
        const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          const children = this.getFileTree(fullPath, maxDepth, currentDepth + 1);
          items.push({
            name: entry.name,
            path: fullPath,
            relativePath,
            isDirectory: true,
            children,
          });
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (BINARY_EXTENSIONS.has(ext)) {
            continue; // Skip large binaries
          }

          let size = 0;
          try {
            size = fs.statSync(fullPath).size;
          } catch {}

          items.push({
            name: entry.name,
            path: fullPath,
            relativePath,
            isDirectory: false,
            size,
          });
        }
      }
    } catch (err: any) {
      console.error(`Failed to read directory ${rootPath}:`, err.message);
    }

    // Sort: directories first, then alphabetical
    return items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }
}
