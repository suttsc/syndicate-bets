// Installable app: registers the service worker (public/sw.js) and keeps the browser's install offer
// so the Settings sheet can show an "Install app" button.

let installOffer = null;
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('Service worker not registered:', error));
  });
}

// Chrome / Edge / Android offer installation through this event; Safari never fires it.
addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installOffer = event;
  notify();
});

addEventListener('appinstalled', () => {
  installOffer = null;
  notify();
});

/** Already running as the installed app (home-screen icon), on any platform. */
export const isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/** iPhone / iPad Safari, where installing is done by hand from the Share menu. */
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const canPromptInstall = () => installOffer !== null;

/** Shows the browser's install dialog. Resolves true if the person installed it. */
export async function promptInstall() {
  if (!installOffer) return false;
  const offer = installOffer;
  installOffer = null;
  await offer.prompt();
  const { outcome } = await offer.userChoice;
  notify();
  return outcome === 'accepted';
}

/** Called whenever the install state may have changed. */
export const onInstallChange = (listener) => listeners.add(listener);
