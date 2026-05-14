/**
 * Light / dark theme — persists in localStorage, applies before paint when loaded in <head>.
 */
(function () {
  const KEY = 'wz_theme';

  function getStored() {
    try {
      const v = localStorage.getItem(KEY);
      if (v === 'light' || v === 'dark') return v;
    } catch (_) {}
    return 'dark';
  }

  function applyTheme(theme) {
    const t = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = t === 'light' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, t);
    } catch (_) {}
    document.dispatchEvent(new CustomEvent('wz-themechange', { detail: { theme: t } }));
    syncThemeToggleUi();
  }

  function syncThemeToggleUi() {
    const mode = document.documentElement.getAttribute('data-theme') || 'dark';
    document.querySelectorAll('[data-wz-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', mode === 'light' ? 'true' : 'false');
      btn.setAttribute(
        'title',
        mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
      );
      btn.setAttribute(
        'aria-label',
        mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
      );
    });
  }

  function syncThemeLogos() {
    const mode = document.documentElement.getAttribute('data-theme') || 'dark';
    document.querySelectorAll('img[data-wz-logo-default][data-wz-logo-light]').forEach(function (img) {
      const darkSrc = img.getAttribute('data-wz-logo-default');
      const lightSrc = img.getAttribute('data-wz-logo-light');
      const next = mode === 'light' ? lightSrc : darkSrc;
      if (next && img.getAttribute('src') !== next) {
        img.setAttribute('src', next);
      }
    });
  }

  window.wzGetTheme = function () {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  };

  window.wzSetTheme = function (theme) {
    applyTheme(theme);
  };

  window.wzToggleTheme = function () {
    applyTheme(wzGetTheme() === 'light' ? 'dark' : 'light');
  };

  window.wzSyncThemeUI = syncThemeToggleUi;
  window.wzSyncThemeLogos = syncThemeLogos;

  applyTheme(getStored());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncThemeLogos, { once: true });
  } else {
    syncThemeLogos();
  }
  document.addEventListener('wz-themechange', syncThemeLogos);
})();
