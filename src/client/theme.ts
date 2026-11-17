export type ThemeId = 'charcoal' | 'midnight' | 'obsidian' | 'slate';
export type AccentId = 'sky' | 'emerald' | 'indigo' | 'rose';
export type FontSizeId = 'compact' | 'default' | 'large';
export type GlassStyleId = 'ultra' | 'frosted' | 'solid';

export interface ThemeSettings {
  theme: ThemeId;
  accent: AccentId;
  fontSize: FontSizeId;
  glassStyle: GlassStyleId;
}

const THEME_COLORS: Record<ThemeId, { bg: string; card: string; border: string }> = {
  charcoal: { bg: '#0d1117', card: '#161b22', border: '#30363d' },
  midnight: { bg: '#080c14', card: '#0e1526', border: '#1e293b' },
  obsidian: { bg: '#000000', card: '#0d0d0d', border: '#262626' },
  slate: { bg: '#0f172a', card: '#1e293b', border: '#334155' },
};

const FONT_SIZES: Record<FontSizeId, string> = {
  compact: '13px',
  default: '14px',
  large: '15px',
};

export function getSavedThemeSettings(): ThemeSettings {
  const theme = (localStorage.getItem('localai_theme') as ThemeId) || 'charcoal';
  const accent = (localStorage.getItem('localai_accent') as AccentId) || 'sky';
  const fontSize = (localStorage.getItem('localai_font_size') as FontSizeId) || 'default';
  const glassStyle = (localStorage.getItem('localai_glass_style') as GlassStyleId) || 'frosted';

  return { theme, accent, fontSize, glassStyle };
}

export function applyTheme(settings: Partial<ThemeSettings>): ThemeSettings {
  const current = getSavedThemeSettings();
  const next: ThemeSettings = {
    theme: settings.theme || current.theme,
    accent: settings.accent || current.accent,
    fontSize: settings.fontSize || current.fontSize,
    glassStyle: settings.glassStyle || current.glassStyle,
  };

  localStorage.setItem('localai_theme', next.theme);
  localStorage.setItem('localai_accent', next.accent);
  localStorage.setItem('localai_font_size', next.fontSize);
  localStorage.setItem('localai_glass_style', next.glassStyle);

  const root = document.documentElement;
  const colors = THEME_COLORS[next.theme] || THEME_COLORS.charcoal;

  // Apply colors to root variables & body
  root.style.setProperty('--app-bg', colors.bg);
  root.style.setProperty('--app-card', colors.card);
  root.style.setProperty('--app-border', colors.border);
  root.style.fontSize = FONT_SIZES[next.fontSize] || '14px';

  root.setAttribute('data-theme', next.theme);
  root.setAttribute('data-accent', next.accent);
  root.setAttribute('data-glass', next.glassStyle);

  if (document.body) {
    document.body.style.backgroundColor = colors.bg;
  }

  return next;
}
