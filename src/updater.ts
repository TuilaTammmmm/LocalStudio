import fs from 'node:fs';
import path from 'node:path';

export interface AppVersionInfo {
  version: string;
  name: string;
  platform: string;
  arch: string;
  nodeVersion: string;
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseNotes?: string;
  releaseUrl?: string;
  publishedAt?: string;
}

export class AppUpdater {
  public static getAppInfo(): AppVersionInfo {
    let version = '1.0.3';
    let name = 'local-ai-studio';

    try {
      const candidates = [
        path.resolve(process.cwd(), 'package.json'),
        path.resolve(__dirname, '../package.json'),
        path.resolve((process as any).resourcesPath || '', 'app.asar/package.json'),
      ];
      for (const p of candidates) {
        if (p && fs.existsSync(p)) {
          const pkg = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (pkg.version) {
            version = pkg.version;
            name = pkg.name || name;
            break;
          }
        }
      }
    } catch {}

    return {
      version,
      name,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    };
  }

  public static async checkForUpdates(repoOwner = 'TuilaTammmmm', repoName = 'LocalWorkspace'): Promise<UpdateCheckResult> {
    const current = this.getAppInfo().version;

    try {
      const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`, {
        headers: {
          'User-Agent': 'LocalAI-Desktop-Core',
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        // Fallback or no releases yet
        return {
          currentVersion: current,
          latestVersion: current,
          hasUpdate: false,
          releaseNotes: 'Bạn đang chạy phiên bản mới nhất của LocalAI Studio.',
        };
      }

      const data = await response.json();
      const latestTag = (data.tag_name || '').replace(/^v/, '');

      const hasUpdate = this.compareSemver(latestTag, current) > 0;

      return {
        currentVersion: current,
        latestVersion: latestTag || current,
        hasUpdate,
        releaseNotes: data.body || '',
        releaseUrl: data.html_url || '',
        publishedAt: data.published_at || '',
      };
    } catch (err: any) {
      return {
        currentVersion: current,
        latestVersion: current,
        hasUpdate: false,
        releaseNotes: `Không thể kết nối đến máy chủ cập nhật: ${err.message}`,
      };
    }
  }

  private static compareSemver(v1: string, v2: string): number {
    const p1 = v1.split('.').map((x) => parseInt(x, 10) || 0);
    const p2 = v2.split('.').map((x) => parseInt(x, 10) || 0);

    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const n1 = p1[i] || 0;
      const n2 = p2[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  }
}
