/**
 * Inline script that runs before React hydrates, to set
 * data-theme / data-surface attributes on <html> from
 * localStorage (or system preference). Prevents the dark-mode
 * flash that React-side hydration would otherwise cause.
 */
export const themeInitScript = `(() => {
  try {
    var t = localStorage.getItem('ffe:theme') || 'system';
    var s = localStorage.getItem('ffe:surface') || 'friendly';
    var resolved = t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : t;
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-surface', s);
  } catch (_) {}
})();`;
