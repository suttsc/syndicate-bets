// Installable app: register the service worker (public/sw.js) once the page has loaded.
if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('Service worker not registered:', error));
  });
}
