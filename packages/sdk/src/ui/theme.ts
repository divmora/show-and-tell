import { ThemeConfig, ThemeMode } from '../types';

/**
 * Standard CSS custom property tokens used throughout ShowAndTell Shadow DOM components.
 */
export const THEME_CSS_VARS = {
  PRIMARY: '--sat-primary',
  PRIMARY_HOVER: '--sat-primary-hover',
  PRIMARY_CONTRAST: '--sat-primary-contrast',
  FONT_FAMILY: '--sat-font-family',
  FONT_MONO: '--sat-font-mono',
  RADIUS: '--sat-radius',
  RADIUS_SM: '--sat-radius-sm',
  RADIUS_MD: '--sat-radius-md',
  RADIUS_LG: '--sat-radius-lg',
  RADIUS_FULL: '--sat-radius-full',
  BG: '--sat-bg',
  BG_SOLID: '--sat-bg-solid',
  SURFACE: '--sat-surface',
  SURFACE_SECONDARY: '--sat-surface-secondary',
  TEXT: '--sat-text',
  TEXT_MUTED: '--sat-text-muted',
  BORDER: '--sat-border',
  BORDER_STRONG: '--sat-border-strong',
  BTN_BG: '--sat-btn-bg',
  BTN_BORDER: '--sat-btn-border',
  BTN_HOVER: '--sat-btn-hover',
  SHADOW: '--sat-shadow',
  DANGER: '--sat-danger',
  DANGER_BORDER: '--sat-danger-border',
  DANGER_HOVER: '--sat-danger-hover',
  WARNING: '--sat-warning',
  SUCCESS: '--sat-success',
  // Modal specific
  MODAL_BG: '--sat-modal-bg',
  MODAL_HEADER_BORDER: '--sat-modal-header-border',
  MODAL_FOOTER_BG: '--sat-modal-footer-bg',
  MODAL_TEXT: '--sat-modal-text',
  MODAL_TEXT_MUTED: '--sat-modal-text-muted',
  MODAL_CARD_BG: '--sat-modal-card-bg',
  MODAL_CARD_BORDER: '--sat-modal-card-border',
  MODAL_BTN_SEC_BG: '--sat-modal-btn-sec-bg',
  MODAL_BTN_SEC_BORDER: '--sat-modal-btn-sec-border',
  MODAL_BTN_SEC_TEXT: '--sat-modal-btn-sec-text',
  MODAL_BTN_SEC_HOVER: '--sat-modal-btn-sec-hover'
} as const;

export const DEFAULT_DARK_TOKENS: Record<string, string> = {
  [THEME_CSS_VARS.PRIMARY]: '#2563eb',
  [THEME_CSS_VARS.PRIMARY_HOVER]: '#1d4ed8',
  [THEME_CSS_VARS.PRIMARY_CONTRAST]: '#ffffff',
  [THEME_CSS_VARS.FONT_FAMILY]:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  [THEME_CSS_VARS.FONT_MONO]:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  [THEME_CSS_VARS.RADIUS]: '8px',
  [THEME_CSS_VARS.RADIUS_SM]: '4px',
  [THEME_CSS_VARS.RADIUS_MD]: '8px',
  [THEME_CSS_VARS.RADIUS_LG]: '16px',
  [THEME_CSS_VARS.RADIUS_FULL]: '9999px',
  [THEME_CSS_VARS.BG]: 'rgba(24, 24, 27, 0.88)',
  [THEME_CSS_VARS.BG_SOLID]: '#18181b',
  [THEME_CSS_VARS.SURFACE]: '#27272a',
  [THEME_CSS_VARS.SURFACE_SECONDARY]: '#18181b',
  [THEME_CSS_VARS.TEXT]: '#ffffff',
  [THEME_CSS_VARS.TEXT_MUTED]: 'rgba(255, 255, 255, 0.5)',
  [THEME_CSS_VARS.BORDER]: 'rgba(255, 255, 255, 0.12)',
  [THEME_CSS_VARS.BORDER_STRONG]: 'rgba(255, 255, 255, 0.2)',
  [THEME_CSS_VARS.BTN_BG]: 'rgba(255, 255, 255, 0.08)',
  [THEME_CSS_VARS.BTN_BORDER]: 'rgba(255, 255, 255, 0.1)',
  [THEME_CSS_VARS.BTN_HOVER]: 'rgba(255, 255, 255, 0.2)',
  [THEME_CSS_VARS.SHADOW]:
    '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
  [THEME_CSS_VARS.DANGER]: '#dc2626',
  [THEME_CSS_VARS.DANGER_BORDER]: '#ef4444',
  [THEME_CSS_VARS.DANGER_HOVER]: '#b91c1c',
  [THEME_CSS_VARS.WARNING]: '#eab308',
  [THEME_CSS_VARS.SUCCESS]: '#10b981',
  // Modal (dark mode)
  [THEME_CSS_VARS.MODAL_BG]: '#18181b',
  [THEME_CSS_VARS.MODAL_HEADER_BORDER]: '#27272a',
  [THEME_CSS_VARS.MODAL_FOOTER_BG]: '#141416',
  [THEME_CSS_VARS.MODAL_TEXT]: '#f4f4f5',
  [THEME_CSS_VARS.MODAL_TEXT_MUTED]: '#a1a1aa',
  [THEME_CSS_VARS.MODAL_CARD_BG]: '#27272a',
  [THEME_CSS_VARS.MODAL_CARD_BORDER]: '#3f3f46',
  [THEME_CSS_VARS.MODAL_BTN_SEC_BG]: '#27272a',
  [THEME_CSS_VARS.MODAL_BTN_SEC_BORDER]: '#3f3f46',
  [THEME_CSS_VARS.MODAL_BTN_SEC_TEXT]: '#f4f4f5',
  [THEME_CSS_VARS.MODAL_BTN_SEC_HOVER]: '#3f3f46'
};

export const DEFAULT_LIGHT_TOKENS: Record<string, string> = {
  [THEME_CSS_VARS.PRIMARY]: '#2563eb',
  [THEME_CSS_VARS.PRIMARY_HOVER]: '#1d4ed8',
  [THEME_CSS_VARS.PRIMARY_CONTRAST]: '#ffffff',
  [THEME_CSS_VARS.FONT_FAMILY]:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  [THEME_CSS_VARS.FONT_MONO]:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  [THEME_CSS_VARS.RADIUS]: '8px',
  [THEME_CSS_VARS.RADIUS_SM]: '4px',
  [THEME_CSS_VARS.RADIUS_MD]: '8px',
  [THEME_CSS_VARS.RADIUS_LG]: '16px',
  [THEME_CSS_VARS.RADIUS_FULL]: '9999px',
  [THEME_CSS_VARS.BG]: 'rgba(255, 255, 255, 0.94)',
  [THEME_CSS_VARS.BG_SOLID]: '#ffffff',
  [THEME_CSS_VARS.SURFACE]: '#f8fafc',
  [THEME_CSS_VARS.SURFACE_SECONDARY]: '#f1f5f9',
  [THEME_CSS_VARS.TEXT]: '#18181b',
  [THEME_CSS_VARS.TEXT_MUTED]: '#71717a',
  [THEME_CSS_VARS.BORDER]: 'rgba(0, 0, 0, 0.12)',
  [THEME_CSS_VARS.BORDER_STRONG]: 'rgba(0, 0, 0, 0.2)',
  [THEME_CSS_VARS.BTN_BG]: 'rgba(0, 0, 0, 0.05)',
  [THEME_CSS_VARS.BTN_BORDER]: 'rgba(0, 0, 0, 0.1)',
  [THEME_CSS_VARS.BTN_HOVER]: 'rgba(0, 0, 0, 0.1)',
  [THEME_CSS_VARS.SHADOW]:
    '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  [THEME_CSS_VARS.DANGER]: '#dc2626',
  [THEME_CSS_VARS.DANGER_BORDER]: '#ef4444',
  [THEME_CSS_VARS.DANGER_HOVER]: '#b91c1c',
  [THEME_CSS_VARS.WARNING]: '#eab308',
  [THEME_CSS_VARS.SUCCESS]: '#10b981',
  // Modal (light mode)
  [THEME_CSS_VARS.MODAL_BG]: '#ffffff',
  [THEME_CSS_VARS.MODAL_HEADER_BORDER]: '#f4f4f5',
  [THEME_CSS_VARS.MODAL_FOOTER_BG]: '#fafafa',
  [THEME_CSS_VARS.MODAL_TEXT]: '#09090b',
  [THEME_CSS_VARS.MODAL_TEXT_MUTED]: '#64748b',
  [THEME_CSS_VARS.MODAL_CARD_BG]: '#f8fafc',
  [THEME_CSS_VARS.MODAL_CARD_BORDER]: '#e2e8f0',
  [THEME_CSS_VARS.MODAL_BTN_SEC_BG]: '#ffffff',
  [THEME_CSS_VARS.MODAL_BTN_SEC_BORDER]: '#e4e4e7',
  [THEME_CSS_VARS.MODAL_BTN_SEC_TEXT]: '#27272a',
  [THEME_CSS_VARS.MODAL_BTN_SEC_HOVER]: '#f4f4f5'
};

/**
 * Determines whether the current environment or mode resolves to 'dark' or 'light'.
 */
export function resolveThemeMode(mode?: ThemeMode): 'dark' | 'light' {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  if (mode === 'auto' && typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

/**
 * Calculates a slightly darker shade of a hex color for hover states.
 */
function darkenHexColor(hex: string, amount = 0.15): string {
  if (!hex.startsWith('#')) return hex;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6 && cleanHex.length !== 3) return hex;

  const r = parseInt(cleanHex.length === 3 ? cleanHex[0] + cleanHex[0] : cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.length === 3 ? cleanHex[1] + cleanHex[1] : cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.length === 3 ? cleanHex[2] + cleanHex[2] : cleanHex.substring(4, 6), 16);

  const newR = Math.max(0, Math.floor(r * (1 - amount)));
  const newG = Math.max(0, Math.floor(g * (1 - amount)));
  const newB = Math.max(0, Math.floor(b * (1 - amount)));

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * Generates a full map of resolved CSS variable names and values based on the provided theme.
 */
export function resolveThemeVariables(theme?: ThemeConfig): Record<string, string> {
  const mode = resolveThemeMode(theme?.mode);
  const baseTokens = mode === 'light' ? { ...DEFAULT_LIGHT_TOKENS } : { ...DEFAULT_DARK_TOKENS };

  if (!theme) {
    return baseTokens;
  }

  // Apply explicit overrides
  if (theme.primaryColor) {
    baseTokens[THEME_CSS_VARS.PRIMARY] = theme.primaryColor;
    baseTokens[THEME_CSS_VARS.PRIMARY_HOVER] =
      theme.primaryHoverColor || darkenHexColor(theme.primaryColor);
  } else if (theme.primaryHoverColor) {
    baseTokens[THEME_CSS_VARS.PRIMARY_HOVER] = theme.primaryHoverColor;
  }

  if (theme.primaryContrastColor) {
    baseTokens[THEME_CSS_VARS.PRIMARY_CONTRAST] = theme.primaryContrastColor;
  }

  if (theme.fontFamily) {
    baseTokens[THEME_CSS_VARS.FONT_FAMILY] = theme.fontFamily;
  }

  if (theme.fontMono) {
    baseTokens[THEME_CSS_VARS.FONT_MONO] = theme.fontMono;
  }

  if (theme.borderRadius) {
    baseTokens[THEME_CSS_VARS.RADIUS] = theme.borderRadius;
    baseTokens[THEME_CSS_VARS.RADIUS_MD] = theme.borderRadius;
  }

  if (theme.backgroundColor) {
    baseTokens[THEME_CSS_VARS.BG] = theme.backgroundColor;
    baseTokens[THEME_CSS_VARS.BG_SOLID] = theme.backgroundColor;
    baseTokens[THEME_CSS_VARS.MODAL_BG] = theme.backgroundColor;
  }

  if (theme.surfaceColor) {
    baseTokens[THEME_CSS_VARS.SURFACE] = theme.surfaceColor;
    baseTokens[THEME_CSS_VARS.MODAL_CARD_BG] = theme.surfaceColor;
    baseTokens[THEME_CSS_VARS.MODAL_BTN_SEC_BG] = theme.surfaceColor;
  }

  if (theme.textColor) {
    baseTokens[THEME_CSS_VARS.TEXT] = theme.textColor;
    baseTokens[THEME_CSS_VARS.MODAL_TEXT] = theme.textColor;
  }

  if (theme.textMutedColor) {
    baseTokens[THEME_CSS_VARS.TEXT_MUTED] = theme.textMutedColor;
    baseTokens[THEME_CSS_VARS.MODAL_TEXT_MUTED] = theme.textMutedColor;
  }

  if (theme.borderColor) {
    baseTokens[THEME_CSS_VARS.BORDER] = theme.borderColor;
    baseTokens[THEME_CSS_VARS.BORDER_STRONG] = theme.borderColor;
    baseTokens[THEME_CSS_VARS.MODAL_HEADER_BORDER] = theme.borderColor;
    baseTokens[THEME_CSS_VARS.MODAL_CARD_BORDER] = theme.borderColor;
  }

  if (theme.dangerColor) {
    baseTokens[THEME_CSS_VARS.DANGER] = theme.dangerColor;
    baseTokens[THEME_CSS_VARS.DANGER_BORDER] = theme.dangerColor;
    baseTokens[THEME_CSS_VARS.DANGER_HOVER] = darkenHexColor(theme.dangerColor);
  }

  if (theme.warningColor) {
    baseTokens[THEME_CSS_VARS.WARNING] = theme.warningColor;
  }

  if (theme.successColor) {
    baseTokens[THEME_CSS_VARS.SUCCESS] = theme.successColor;
  }

  // Arbitrary CSS variable overrides
  if (theme.cssVariables) {
    for (const [key, value] of Object.entries(theme.cssVariables)) {
      const varName = key.startsWith('--') ? key : `--${key}`;
      baseTokens[varName] = value;
    }
  }

  return baseTokens;
}

/**
 * Injects CSS custom properties and mode attributes directly onto a Shadow DOM host element.
 * This guarantees proper inheritance down into the Shadow DOM tree while allowing host CSS overrides.
 */
export function applyThemeToHost(host: HTMLElement, theme?: ThemeConfig): void {
  if (!host) return;

  const mode = resolveThemeMode(theme?.mode);
  host.setAttribute('data-theme', mode);
  host.classList.remove('sat-theme-dark', 'sat-theme-light');
  host.classList.add(`sat-theme-${mode}`);

  const variables = resolveThemeVariables(theme);

  // Apply each custom property to the host element's inline style
  for (const [prop, value] of Object.entries(variables)) {
    host.style.setProperty(prop, value);
  }
}
