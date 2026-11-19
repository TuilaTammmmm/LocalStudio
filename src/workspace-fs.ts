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

export interface RAGSearchResult {
  filePath: string;
  relativePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
  score: number;
}

const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.localai',
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
    currentDepth = 0,
    baseRoot = rootPath
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
        const relativePath = path.relative(baseRoot, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          const children = this.getFileTree(fullPath, maxDepth, currentDepth + 1, baseRoot);
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

  /**
   * Search recursively within workspace boundary for a file by basename.
   */
  public static findFileByName(
    rootPath: string,
    targetName: string,
    maxDepth = 6,
    currentDepth = 0
  ): string | null {
    if (!fs.existsSync(rootPath) || currentDepth >= maxDepth) return null;
    try {
      const entries = fs.readdirSync(rootPath, { withFileTypes: true });
      for (const entry of entries) {
        if (DEFAULT_IGNORED_DIRS.has(entry.name)) continue;
        const fullPath = path.join(rootPath, entry.name);
        if (entry.isFile() && entry.name.toLowerCase() === targetName.toLowerCase()) {
          return fullPath;
        }
        if (entry.isDirectory()) {
          const found = this.findFileByName(fullPath, targetName, maxDepth, currentDepth + 1);
          if (found) return found;
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Applies SEARCH/REPLACE blocks formatted as:
   * <<<<<<< SEARCH
   * [exact text to find]
   * =======
   * [replacement text]
   * >>>>>>> REPLACE
   * If multiple SEARCH/REPLACE blocks exist in the text, apply all of them in order.
   * If not in this block format, return newContentOrPatch as full replacement.
   */
  public static applyPatchOrFullContent(
    originalContent: string,
    newContentOrPatch: string
  ): { updatedContent: string; appliedAsPatch: boolean } {
    if (typeof newContentOrPatch !== 'string') {
      return { updatedContent: originalContent ?? '', appliedAsPatch: false };
    }

    const SEARCH_REPLACE_REGEX =
      /<{7} SEARCH[^\S\r\n]*(?:\r?\n([\s\S]*?))?\r?\n={7}[^\S\r\n]*(?:\r?\n([\s\S]*?))?\r?\n>{7} REPLACE[^\S\r\n]*/g;

    const matches = Array.from(newContentOrPatch.matchAll(SEARCH_REPLACE_REGEX));

    if (matches.length === 0) {
      return { updatedContent: newContentOrPatch, appliedAsPatch: false };
    }

    let currentContent = originalContent ?? '';

    for (const match of matches) {
      const search = match[1] ?? '';
      const replace = match[2] ?? '';

      if (currentContent.includes(search)) {
        currentContent = currentContent.replace(search, () => replace);
      } else {
        // Try normalized newline matching (CRLF vs LF)
        const normCurrent = currentContent.replace(/\r\n/g, '\n');
        const normSearch = search.replace(/\r\n/g, '\n');
        const normReplace = replace.replace(/\r\n/g, '\n');

        if (normCurrent.includes(normSearch)) {
          const isCRLF = currentContent.includes('\r\n');
          const replaced = normCurrent.replace(normSearch, () => normReplace);
          currentContent = isCRLF ? replaced.replace(/\n/g, '\r\n') : replaced;
        } else {
          throw new Error(
            `Failed to apply patch: search block not found in original content: "${search}"`
          );
        }
      }
    }

    return { updatedContent: currentContent, appliedAsPatch: true };
  }

  /**
   * Fast, zero-dependency offline semantic/keyword RAG retrieval across workspace files.
   * Splits text files into 25-line overlapping chunks, scoring each by query term relevance.
   */
  public static searchWorkspaceRAG(
    rootPath: string,
    query: string,
    maxResults = 8
  ): RAGSearchResult[] {
    if (!rootPath || !fs.existsSync(rootPath) || !query || !query.trim()) {
      return [];
    }

    const cleanQuery = query.trim().toLowerCase();
    const rawTerms = cleanQuery.split(/[\s,./\\:;!?()[\]{}'"]+/).filter((t) => t.length >= 2);
    const terms = Array.from(new Set(rawTerms));
    if (terms.length === 0) return [];

    const results: RAGSearchResult[] = [];

    // Helper to crawl files recursively
    const crawl = (currentDir: string, currentDepth = 0) => {
      if (currentDepth > 8) return;
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (DEFAULT_IGNORED_DIRS.has(entry.name)) continue;
          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            crawl(fullPath, currentDepth + 1);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (BINARY_EXTENSIONS.has(ext)) continue;

            try {
              const stat = fs.statSync(fullPath);
              if (stat.size > 500 * 1024) continue; // Skip huge files > 500KB

              const content = fs.readFileSync(fullPath, 'utf-8');
              const lines = content.split(/\r?\n/);
              const chunkSize = 25;
              const overlap = 5;
              const step = chunkSize - overlap;

              for (let i = 0; i < lines.length; i += step) {
                const chunkLines = lines.slice(i, i + chunkSize);
                if (chunkLines.length === 0) continue;
                const chunkText = chunkLines.join('\n');
                const lowerChunk = chunkText.toLowerCase();

                let score = 0;
                let matchedTermCount = 0;

                // Exact phrase bonus
                if (cleanQuery.length > 3 && lowerChunk.includes(cleanQuery)) {
                  score += 15;
                }

                for (const term of terms) {
                  if (lowerChunk.includes(term)) {
                    matchedTermCount++;
                    // Term frequency in this chunk
                    const count = lowerChunk.split(term).length - 1;
                    score += Math.min(count * 2, 8);
                  }
                }

                // Coverage bonus: reward chunks that match multiple terms
                if (matchedTermCount > 1) {
                  score += matchedTermCount * 3;
                }
                if (matchedTermCount === terms.length && terms.length > 1) {
                  score += 10;
                }

                if (score > 0) {
                  const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
                  results.push({
                    filePath: fullPath,
                    relativePath,
                    startLine: i + 1,
                    endLine: Math.min(i + chunkSize, lines.length),
                    snippet: chunkLines.join('\n'),
                    score,
                  });
                }
              }
            } catch {}
          }
        }
      } catch {}
    };

    crawl(rootPath, 0);

    // Sort descending by score, then deduplicate adjacent chunks in same file
    results.sort((a, b) => b.score - a.score);

    const filtered: RAGSearchResult[] = [];
    const seenLocations = new Set<string>();

    for (const res of results) {
      const locKey = `${res.relativePath}:${Math.floor(res.startLine / 15)}`;
      if (!seenLocations.has(locKey)) {
        seenLocations.add(locKey);
        filtered.push(res);
        if (filtered.length >= maxResults) break;
      }
    }

    return filtered;
  }
}
