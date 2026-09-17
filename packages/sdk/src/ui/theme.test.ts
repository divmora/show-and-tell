import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resolveThemeMode,
  resolveThemeVariables,
  applyThemeToHost,
  THEME_CSS_VARS,
  DEFAULT_DARK_TOKENS,
  DEFAULT_LIGHT_TOKENS
} from './theme';

describe('ShowAndTell Theming Subsystem', () => {
  let hostElement: HTMLElement;

  beforeEach(() => {
    hostElement = document.createElement('div');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveThemeMode', () => {
    it('returns "dark" by default when no mode is passed', () => {
      expect(resolveThemeMode()).toBe('dark');
      expect(resolveThemeMode(undefined)).toBe('dark');
    });

    it('returns "dark" when explicitly set to dark', () => {
      expect(resolveThemeMode('dark')).toBe('dark');
    });

    it('returns "light" when explicitly set to light', () => {
      expect(resolveThemeMode('light')).toBe('light');
    });

    it('resolves "auto" mode using window.matchMedia', () => {
      // Mock light preference
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query.includes('light'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }));

      expect(resolveThemeMode('auto')).toBe('light');

      // Mock dark preference
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: !query.includes('light'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }));

      expect(resolveThemeMode('auto')).toBe('dark');
    });
  });

  describe('resolveThemeVariables', () => {
    it('returns DEFAULT_DARK_TOKENS when theme is empty or dark', () => {
      const vars = resolveThemeVariables();
      expect(vars[THEME_CSS_VARS.PRIMARY]).toBe('#2563eb');
      expect(vars[THEME_CSS_VARS.BG]).toBe(DEFAULT_DARK_TOKENS[THEME_CSS_VARS.BG]);
      expect(vars[THEME_CSS_VARS.TEXT]).toBe('#ffffff');
    });

    it('returns DEFAULT_LIGHT_TOKENS when mode is light', () => {
      const vars = resolveThemeVariables({ mode: 'light' });
      expect(vars[THEME_CSS_VARS.PRIMARY]).toBe('#2563eb');
      expect(vars[THEME_CSS_VARS.BG]).toBe(DEFAULT_LIGHT_TOKENS[THEME_CSS_VARS.BG]);
      expect(vars[THEME_CSS_VARS.TEXT]).toBe('#18181b');
    });

    it('overrides primaryColor and automatically computes darker hover color', () => {
      const vars = resolveThemeVariables({ primaryColor: '#6366f1' });
      expect(vars[THEME_CSS_VARS.PRIMARY]).toBe('#6366f1');
      expect(vars[THEME_CSS_VARS.PRIMARY_HOVER]).toBeDefined();
      expect(vars[THEME_CSS_VARS.PRIMARY_HOVER]).not.toBe('#6366f1');
    });

    it('respects explicit primaryHoverColor', () => {
      const vars = resolveThemeVariables({
        primaryColor: '#6366f1',
        primaryHoverColor: '#4f46e5'
      });
      expect(vars[THEME_CSS_VARS.PRIMARY]).toBe('#6366f1');
      expect(vars[THEME_CSS_VARS.PRIMARY_HOVER]).toBe('#4f46e5');
    });

    it('overrides fontFamily and borderRadius', () => {
      const vars = resolveThemeVariables({
        fontFamily: 'Inter, sans-serif',
        borderRadius: '12px'
      });
      expect(vars[THEME_CSS_VARS.FONT_FAMILY]).toBe('Inter, sans-serif');
      expect(vars[THEME_CSS_VARS.RADIUS]).toBe('12px');
      expect(vars[THEME_CSS_VARS.RADIUS_MD]).toBe('12px');
    });

    it('overrides background, surface, text, and border colors', () => {
      const vars = resolveThemeVariables({
        backgroundColor: '#0a0a0a',
        surfaceColor: '#171717',
        textColor: '#fafafa',
        textMutedColor: '#a3a3a3',
        borderColor: '#262626'
      });
      expect(vars[THEME_CSS_VARS.BG]).toBe('#0a0a0a');
      expect(vars[THEME_CSS_VARS.SURFACE]).toBe('#171717');
      expect(vars[THEME_CSS_VARS.TEXT]).toBe('#fafafa');
      expect(vars[THEME_CSS_VARS.TEXT_MUTED]).toBe('#a3a3a3');
      expect(vars[THEME_CSS_VARS.BORDER]).toBe('#262626');
    });

    it('supports custom arbitrary cssVariables dictionary', () => {
      const vars = resolveThemeVariables({
        cssVariables: {
          '--sat-custom-token': '10px',
          'sat-custom-token-no-dash': 'red'
        }
      });
      expect(vars['--sat-custom-token']).toBe('10px');
      expect(vars['--sat-custom-token-no-dash']).toBe('red');
    });
  });

  describe('applyThemeToHost', () => {
    it('applies data-theme attribute and CSS variables to host element', () => {
      applyThemeToHost(hostElement, {
        mode: 'light',
        primaryColor: '#10b981',
        borderRadius: '14px'
      });

      expect(hostElement.getAttribute('data-theme')).toBe('light');
      expect(hostElement.classList.contains('sat-theme-light')).toBe(true);
      expect(hostElement.style.getPropertyValue('--sat-primary')).toBe('#10b981');
      expect(hostElement.style.getPropertyValue('--sat-radius')).toBe('14px');
    });

    it('handles dark mode switching cleanly', () => {
      applyThemeToHost(hostElement, { mode: 'light' });
      expect(hostElement.getAttribute('data-theme')).toBe('light');

      applyThemeToHost(hostElement, { mode: 'dark', primaryColor: '#f43f5e' });
      expect(hostElement.getAttribute('data-theme')).toBe('dark');
      expect(hostElement.classList.contains('sat-theme-dark')).toBe(true);
      expect(hostElement.classList.contains('sat-theme-light')).toBe(false);
      expect(hostElement.style.getPropertyValue('--sat-primary')).toBe('#f43f5e');
    });

    it('gracefully handles null or undefined host', () => {
      expect(() => applyThemeToHost(null as any)).not.toThrow();
    });
  });
});
