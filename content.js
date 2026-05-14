// Fallback blocker — catches cases declarativeNetRequest misses:
// bare domains (x.com vs *.x.com), and SPA client-side navigations.
// Runs at document_start so the page has no time to render.

(async () => {
  const { blockedSites = [] } = await chrome.storage.sync.get('blockedSites');
  if (!blockedSites.length) return;

  function findMatch(hostname) {
    const host = hostname.replace(/^www\./, '');
    return blockedSites.find(
      s => host === s.domain || host.endsWith('.' + s.domain)
    );
  }

  function redirectIfBlocked() {
    const match = findMatch(location.hostname);
    if (match) {
      location.replace(
        chrome.runtime.getURL(
          'blocked.html?site=' + encodeURIComponent(match.name)
        )
      );
    }
  }

  // Immediate check on page load
  redirectIfBlocked();

  // Catch SPA navigations: X (Twitter), Instagram, TikTok all use pushState
  const _push    = history.pushState.bind(history);
  const _replace = history.replaceState.bind(history);

  history.pushState = (...args) => { _push(...args);    redirectIfBlocked(); };
  history.replaceState = (...args) => { _replace(...args); redirectIfBlocked(); };

  window.addEventListener('popstate', redirectIfBlocked);
})();
