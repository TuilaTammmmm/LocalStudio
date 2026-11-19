import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import YAML from 'yaml';
import type { LocalSkill } from './types.js';

export class SkillsScanner {
  /**
   * Auto-discover global skill paths on the user's machine
   */
  public static detectGlobalSkillDirectories(): string[] {
    const home = os.homedir();
    const candidateRoots = [
      path.join(home, '.gemini', 'config', 'skills'),
      path.join(home, '.gemini', 'config', 'plugins'),
      path.join(home, '.gemini', 'antigravity', 'builtin', 'skills'),
      path.join(home, '.gemini', 'skills'),
      path.join(home, '.skills'),
      path.join(home, '.config', 'skills'),
      path.join(home, '.cursor', 'skills'),
      path.resolve(process.cwd(), '.skills'),
    ];

    const discoveredDirs: string[] = [];

    for (const root of candidateRoots) {
      if (!fs.existsSync(root)) continue;

      discoveredDirs.push(root);

      // If it's a plugins directory, look for plugin/skills subdirectories
      try {
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const pluginSkillDir = path.join(root, entry.name, 'skills');
            if (fs.existsSync(pluginSkillDir)) {
              discoveredDirs.push(pluginSkillDir);
            }
          }
        }
      } catch {}
    }

    return Array.from(new Set(discoveredDirs));
  }

  /**
   * Scan multiple directories for folders containing SKILL.md
   */
  public static scanDirectories(directoryPaths: string[] = [], includeGlobal = true): LocalSkill[] {
    const allPaths = includeGlobal
      ? Array.from(new Set([...this.detectGlobalSkillDirectories(), ...directoryPaths]))
      : directoryPaths;
    const skills: LocalSkill[] = [];
    const seenIds = new Set<string>();

    for (const dirPath of allPaths) {
      if (!fs.existsSync(dirPath)) continue;

      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const isDir = entry.isDirectory() || (entry.isSymbolicLink() && (() => {
            try { return fs.statSync(path.join(dirPath, entry.name)).isDirectory(); } catch { return false; }
          })());
          if (!isDir) continue;

          const skillDir = path.join(dirPath, entry.name);
          const skillFile = path.join(skillDir, 'SKILL.md');

          if (fs.existsSync(skillFile)) {
            const parsed = this.parseSkillFile(entry.name, skillDir, skillFile);
            if (parsed && !seenIds.has(parsed.id)) {
              seenIds.add(parsed.id);
              skills.push(parsed);
            }
          }
        }
      } catch (err: any) {
        console.error(`Failed to scan skills in ${dirPath}:`, err.message);
      }
    }

    return skills;
  }

  /**
   * Parse a SKILL.md file with YAML frontmatter
   */
  public static parseSkillFile(
    defaultId: string,
    dirPath: string,
    skillFilePath: string
  ): LocalSkill | null {
    try {
      const content = fs.readFileSync(skillFilePath, 'utf-8');
      const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

      let name = defaultId;
      let description = '';
      let triggers: string[] = [`/${defaultId}`];
      let systemInstructions = content;

      if (frontmatterMatch) {
        const yamlRaw = frontmatterMatch[1];
        systemInstructions = frontmatterMatch[2].trim();

        try {
          const parsedYaml = YAML.parse(yamlRaw);
          if (parsedYaml.name) name = parsedYaml.name;
          if (parsedYaml.description) description = parsedYaml.description;
          if (Array.isArray(parsedYaml.triggers)) {
            triggers = parsedYaml.triggers.map((t: string) => (t.startsWith('/') ? t : `/${t}`));
          } else {
            triggers = [`/${name.toLowerCase().replace(/\s+/g, '-')}`];
          }
        } catch (yamlErr: any) {
          console.warn(`Warning parsing YAML in ${skillFilePath}:`, yamlErr.message);
        }
      }

      return {
        id: defaultId,
        name,
        description,
        dirPath,
        skillFilePath,
        enabled: true,
        safeExecution: true,
        systemInstructions,
        triggers,
      };
    } catch (err: any) {
      console.error(`Error reading skill file ${skillFilePath}:`, err.message);
      return null;
    }
  }
}
