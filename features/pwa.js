(function() {
  let installPrompt = null;
  let serviceWorkerReady = false;

  function statusElement() {
    return document.getElementById('pwaStatus');
  }

  function updateStatus() {
    const status = statusElement();
    if (!status) return;

    if (!('serviceWorker' in navigator)) {
      status.textContent = 'Offline support is not available in this browser.';
      return;
    }
    if (location.protocol === 'file:') {
      status.textContent = 'Serve Skyline over HTTPS or localhost to enable offline support.';
      return;
    }
    if (!navigator.onLine) {
      status.textContent = serviceWorkerReady
        ? 'Offline · cached app shell is available; live weather needs an internet connection.'
        : 'Offline · the cached app shell is not confirmed yet. Reconnect to load Skyline.';
      return;
    }
    status.textContent = serviceWorkerReady
      ? 'Online · app shell cached for offline use.'
      : 'Online · preparing offline support…';
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    const button = document.getElementById('installAppButton');
    if (button) button.disabled = false;
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    const button = document.getElementById('installAppButton');
    if (button) {
      button.disabled = true;
      button.textContent = 'Installed';
    }
    updateStatus();
  });

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);

  document.addEventListener('DOMContentLoaded', () => {
    const host = document.getElementById('featurePanels');
    if (host) {
      const section = document.createElement('section');
      section.className = 'feature-panel';
      section.innerHTML = '<div class="feature-heading"><div><div class="card-label">Install Skyline</div><p class="feature-subtitle" id="pwaStatus">Checking offline support…</p></div><button id="installAppButton" type="button" class="feature-action" disabled>Install app</button></div><p class="feature-subtitle pwa-hint">On supported browsers, use Install app. On iPhone/iPad, use Share → Add to Home Screen.</p>';
      host.append(section);

      const button = document.getElementById('installAppButton');
      if (button) {
        button.disabled = !installPrompt;
        button.addEventListener('click', async () => {
          if (!installPrompt) return;
          const promptEvent = installPrompt;
          installPrompt = null;
          button.disabled = true;
          try {
            await promptEvent.prompt();
            const choice = await promptEvent.userChoice;
            button.textContent = choice && choice.outcome === 'accepted' ? 'Installed' : 'Install app';
            updateStatus();
          } catch {
            button.textContent = 'Install app';
            updateStatus();
          }
        });
      }
    }

    updateStatus();
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;

    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(() => navigator.serviceWorker.ready)
      .then(registration => {
        if (!registration || !registration.active) {
          throw new Error('Service worker did not become active.');
        }
        serviceWorkerReady = true;
        updateStatus();
      })
      .catch(() => {
        serviceWorkerReady = false;
        const status = statusElement();
        if (status) status.textContent = 'Offline support could not be registered in this browser.';
      });
  });
})();