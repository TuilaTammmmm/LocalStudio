import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { WorkspaceFS } from './workspace-fs.js';

export interface ContextFile {
  relativePath: string;
  absolutePath: string;
  content: string;
  sizeBytes: number;
  estimatedTokens: number;
}

export interface ContextBundle {
  files: ContextFile[];
  totalTokens: number;
  warnings: string[];
}

export class ContextBuilder {
  /**
   * Approximate token count (rule of thumb: ~4 characters per token for code/English)
   */
  public static estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.8);
  }

  /**
   * Read multiple files from workspace root safely
   */
  public static buildContext(
    workspaceRoot: string,
    relativeFilePaths: string[],
    maxFileSizeLimitBytes = 500 * 1024 // 500KB limit
  ): ContextBundle {
    const files: ContextFile[] = [];
    const warnings: string[] = [];
    let totalTokens = 0;

    for (const relPath of relativeFilePaths) {
      let fullPath = path.isAbsolute(relPath) ? relPath : path.resolve(workspaceRoot, relPath);

      // Prevent directory traversal attacks for relative paths
      if (!path.isAbsolute(relPath) && !WorkspaceFS.isSafePath(workspaceRoot, relPath)) {
        warnings.push(`Security: Ignored path outside workspace boundary: ${relPath}`);
        continue;
      }

      if (!fs.existsSync(fullPath)) {
        // Fallback: search recursively by file name inside workspace
        const found = WorkspaceFS.findFileByName(workspaceRoot, path.basename(relPath));
        if (found && fs.existsSync(found)) {
          fullPath = found;
        } else {
          warnings.push(`File not found: ${relPath}`);
          continue;
        }
      }

      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          warnings.push(`Skipping directory: ${relPath}`);
          continue;
        }

        if (stat.size > maxFileSizeLimitBytes) {
          warnings.push(`File too large (${Math.round(stat.size / 1024)}KB): ${relPath} (Max allowed: 500KB)`);
          continue;
        }

        let content = '';
        const ext = path.extname(fullPath).toLowerCase();
        if (ext === '.docx') {
          try {
            const pyScript = `import zipfile, xml.etree.ElementTree as ET; z = zipfile.ZipFile(r'''${fullPath}'''); t = ET.fromstring(z.read('word/document.xml')); print(''.join(t.itertext()))`;
            content = execSync(`python -c "${pyScript}"`, { encoding: 'utf-8', timeout: 5000 }).trim();
          } catch (docErr: any) {
            content = `[Lỗi đọc tài liệu docx: ${docErr.message}]`;
          }
        } else {
          content = fs.readFileSync(fullPath, 'utf-8');
        }

        const estimatedTokens = this.estimateTokens(content);
        totalTokens += estimatedTokens;

        files.push({
          relativePath: relPath,
          absolutePath: fullPath,
          content,
          sizeBytes: stat.size,
          estimatedTokens,
        });
      } catch (err: any) {
        warnings.push(`Error reading ${relPath}: ${err.message}`);
      }
    }

    return {
      files,
      totalTokens,
      warnings,
    };
  }
}
