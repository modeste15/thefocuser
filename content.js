// Fallback blocker — catches cases declarativeNetRequest misses:
// bare domains (x.com), SPA client-side navigations, and schedule-aware blocking.

(async () => {
  const { blockedSites = [] } = await chrome.storage.sync.get('blockedSites');
  if (!blockedSites.length) return;

  function isSiteActiveNow(site) {
    const s = site.schedule;
    if (!s || s.type === 'always') return true;
    if (s.type === 'duration') return !!(s.until && Date.now() < s.until);
    if (s.type === 'timerange') {
      if (!s.startTime || !s.endTime) return true;
      const now = new Date();
      const cur = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      const start = sh * 60 + sm, end = eh * 60 + em;
      return start <= end
        ? cur >= start && cur < end
        : cur >= start || cur < end;
    }
    return true;
  }

  function findActiveMatch(hostname) {
    const host = hostname.replace(/^www\./, '');
    return blockedSites.find(s =>
      isSiteActiveNow(s) && (host === s.domain || host.endsWith('.' + s.domain))
    );
  }

  function redirectIfBlocked() {
    const match = findActiveMatch(location.hostname);
    if (match) {
      location.replace(
        chrome.runtime.getURL('blocked.html?site=' + encodeURIComponent(match.name))
      );
    }
  }

  redirectIfBlocked();

  // Hook SPA navigations (X/Twitter, Instagram, TikTok all use pushState)
  const _push    = history.pushState.bind(history);
  const _replace = history.replaceState.bind(history);
  history.pushState    = (...args) => { _push(...args);    redirectIfBlocked(); };
  history.replaceState = (...args) => { _replace(...args); redirectIfBlocked(); };
  window.addEventListener('popstate', redirectIfBlocked);
})();
