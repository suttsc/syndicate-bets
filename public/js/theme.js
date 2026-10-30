// Appearance: the mode (dark / light, data-theme on <html>) and the theme (data-style on <html>).
// Both are remembered per device and applied by an inline script in each page's <head> before first
// paint, so there's no flash; this module changes them from the Settings sheet.

export const MODES = ['dark', 'light'];

export const THEMES = [
  {
    id: 'floodlight',
    name: 'Floodlight',
    description: 'Near-black with a green glow and sharp corners.',
    // Swatch colours and headline font for the picker, and the browser bar colour per mode.
    swatch: ['#050706', '#34d399', '#f97316'],
    font: '"Space Grotesk", sans-serif',
    bar: { dark: '#050706', light: '#f3f5f4' },
  },
  {
    id: 'terrace',
    name: 'Terrace',
    description: 'Retro matchday programme: navy and gold, condensed headlines.',
    swatch: ['#0a1128', '#f5c542', '#fffaf0'],
    font: '"Oswald", sans-serif',
    bar: { dark: '#0a1128', light: '#f5efe2' },
  },
];

const root = document.documentElement;

export const currentMode = () => (root.dataset.theme === 'light' ? 'light' : 'dark');
export const currentTheme = () => THEMES.find((t) => t.id === root.dataset.style) ?? THEMES[0];

function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode): the choice just lasts for this page view.
  }
}

/** The phone's status / browser bar follows the page. */
function syncBar() {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', currentTheme().bar[currentMode()]);
}

export function setMode(mode) {
  root.dataset.theme = MODES.includes(mode) ? mode : 'dark';
  remember('theme', root.dataset.theme);
  syncBar();
}

export function setTheme(id) {
  root.dataset.style = THEMES.some((t) => t.id === id) ? id : THEMES[0].id;
  remember('style', root.dataset.style);
  syncBar();
}

syncBar();
