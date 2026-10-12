// Light / dark mode. The initial theme is applied by an inline script in each page's <head>
// (before first paint, so there's no flash); this module renders and wires up the toggle.
const KEY = 'theme';
const THEME_COLOR = { dark: '#050706', light: '#f3f5f4' };

const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
const MOON = '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>';

const current = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Storage blocked (private mode): the choice just lasts for this page view.
  }
}

/** Shows the icon for the mode a tap switches to. */
function render(button) {
  const next = current() === 'dark' ? 'light' : 'dark';
  button.setAttribute('aria-label', `Switch to ${next} mode`);
  button.innerHTML = `<svg class="size-[12px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${next === 'light' ? SUN : MOON}</svg>`;
}

/** Turns every [data-theme-toggle] button on the page into a working toggle. */
export function mountThemeToggle() {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[current()]);

  for (const button of document.querySelectorAll('[data-theme-toggle]')) {
    render(button);
    button.addEventListener('click', () => {
      apply(current() === 'dark' ? 'light' : 'dark');
      document.querySelectorAll('[data-theme-toggle]').forEach(render);
    });
  }
}

mountThemeToggle();
