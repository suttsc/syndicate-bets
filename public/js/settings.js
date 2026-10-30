// Settings sheet: mode (dark / light), theme, installing the app, and which version is running.
// Opened by any [data-open-settings] button (the tab bar's Settings tab, the admin header's gear).
import { canPromptInstall, isInstalled, isIos, onInstallChange, promptInstall } from './pwa.js';
import { MODES, THEMES, currentMode, currentTheme, setMode, setTheme } from './theme.js';
import { esc } from './ui.js';

const LABEL = 'text-[7.5px] font-semibold tracking-wider text-zinc-400 uppercase';
const MODE_ICONS = {
  dark: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
};

let build = null;
import('./version.js').then(({ BUILD }) => { build = BUILD; render(); }).catch(() => {});

const dialog = document.createElement('dialog');
dialog.id = 'settings';
dialog.setAttribute('aria-labelledby', 'settings-title');
dialog.className = 'm-0 mt-auto w-full max-w-none bg-transparent p-0 text-zinc-100 backdrop:bg-black/50 backdrop:backdrop-blur-sm';
document.body.append(dialog);

const icon = (paths, size = 'size-4') =>
  `<svg class="${size} shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

function modeControl() {
  const mode = currentMode();
  return `
    <div role="radiogroup" aria-label="Mode" class="mt-2 grid grid-cols-2 gap-1 rounded-xs bg-tint/5 p-1 ring-1 ring-tint/10">
      ${MODES.map((m) => `
        <button type="button" role="radio" aria-checked="${m === mode}" data-mode="${m}"
          class="flex h-10 items-center justify-center gap-2 rounded-xs text-sm font-bold capitalize transition ${m === mode ? 'grad-win text-black shadow-[0_6px_24px_-8px_rgb(16_185_129/0.8)]' : 'text-zinc-400'}">
          ${icon(MODE_ICONS[m])}${m}
        </button>`).join('')}
    </div>`;
}

function themeControl() {
  const active = currentTheme();
  return `
    <div role="radiogroup" aria-label="Theme" class="mt-2 grid gap-2">
      ${THEMES.map((theme) => {
        const on = theme.id === active.id;
        return `
          <button type="button" role="radio" aria-checked="${on}" data-theme-choice="${theme.id}"
            class="flex items-center gap-3 rounded-xs p-3 text-left transition active:scale-[.99] ${on ? 'bg-emerald-400/10 ring-2 ring-emerald-400' : 'bg-tint/5 ring-1 ring-tint/10'}">
            <span class="flex shrink-0 overflow-hidden rounded-xs ring-1 ring-tint/15" aria-hidden="true">
              ${theme.swatch.map((colour) => `<span class="h-9 w-4" style="background:${colour}"></span>`).join('')}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-lg leading-tight font-bold" style="font-family:${theme.font}">${esc(theme.name)}</span>
              <span class="block text-xs text-zinc-400">${esc(theme.description)}</span>
            </span>
            ${on ? icon('<path d="m5 12 5 5L20 7"/>', 'size-5 text-emerald-400') : ''}
          </button>`;
      }).join('')}
    </div>`;
}

function installControl() {
  if (isInstalled()) {
    return `<p class="mt-2 flex items-center gap-2 text-sm text-zinc-300">${icon('<path d="m5 12 5 5L20 7"/>', 'size-4 text-emerald-400')}Installed on this device</p>`;
  }
  if (canPromptInstall()) {
    return `
      <button type="button" data-install class="grad-win mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xs font-display text-sm font-bold text-black shadow-[0_6px_24px_-8px_rgb(16_185_129/0.8)] transition active:scale-[.98]">
        ${icon('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>')}Install app
      </button>
      <p class="mt-2 text-xs text-zinc-500">Adds Syndicate Bets to your home screen. It opens full screen and works offline.</p>`;
  }
  if (isIos()) {
    return `<p class="mt-2 text-sm text-zinc-300">In Safari, tap <b class="text-fg">Share</b>, then <b class="text-fg">Add to Home Screen</b>.</p>`;
  }
  return `<p class="mt-2 text-sm text-zinc-300">Use your browser's menu and choose <b class="text-fg">Install app</b> or <b class="text-fg">Add to Home screen</b>.</p>`;
}

function versionLine() {
  if (!build) return '';
  const when = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(build.time));
  return `Version ${esc(build.commit)} · updated ${esc(when)}`;
}

function render() {
  dialog.innerHTML = `
    <div class="mx-auto max-h-[85dvh] max-w-md overflow-y-auto rounded-t-xl border-t border-tint/10 bg-ink px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-20px_60px_-20px_rgb(0_0_0/0.6)]">
      <div class="mx-auto h-1 w-10 rounded-full bg-tint/15" aria-hidden="true"></div>
      <div class="mt-3 flex items-center justify-between">
        <h2 id="settings-title" class="font-display text-2xl font-bold tracking-tight">Settings</h2>
        <button type="button" data-close class="rounded-xs px-3 py-2 text-sm font-semibold text-zinc-300 ring-1 ring-tint/10 active:scale-95">Done</button>
      </div>

      <section class="mt-5">
        <h3 class="${LABEL}">Mode</h3>
        ${modeControl()}
      </section>

      <section class="mt-5">
        <h3 class="${LABEL}">Theme</h3>
        ${themeControl()}
      </section>

      <section class="mt-5">
        <h3 class="${LABEL}">App</h3>
        ${installControl()}
      </section>

      <p class="mt-6 text-center text-xs text-zinc-500 tabular">${versionLine()}</p>
    </div>`;
}

export function openSettings() {
  render();
  dialog.showModal();
}

dialog.addEventListener('click', async (event) => {
  // A tap on the dimmed backdrop (the dialog itself, outside the sheet) closes it.
  if (event.target === dialog || event.target.closest('[data-close]')) {
    dialog.close();
    return;
  }

  const mode = event.target.closest('[data-mode]');
  const theme = event.target.closest('[data-theme-choice]');

  let refocus = null;
  if (mode) {
    setMode(mode.dataset.mode);
    refocus = `[data-mode="${mode.dataset.mode}"]`;
  } else if (theme) {
    setTheme(theme.dataset.themeChoice);
    refocus = `[data-theme-choice="${theme.dataset.themeChoice}"]`;
  } else if (event.target.closest('[data-install]')) {
    await promptInstall();
  } else {
    return;
  }

  render();
  // The sheet was redrawn: keep keyboard focus on the control that was used.
  if (refocus) dialog.querySelector(refocus)?.focus();
});

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-open-settings]')) openSettings();
});

onInstallChange(() => dialog.open && render());
