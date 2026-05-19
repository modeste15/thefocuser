const DEFAULT_SITES = [
  { id: 1, domain: 'facebook.com',  name: 'Facebook',    isDefault: true },
  { id: 2, domain: 'instagram.com', name: 'Instagram',   isDefault: true },
  { id: 3, domain: 'twitter.com',   name: 'Twitter',     isDefault: true },
  { id: 4, domain: 'x.com',         name: 'X (Twitter)', isDefault: true },
  { id: 5, domain: 'tiktok.com',    name: 'TikTok',      isDefault: true },
];

let pauseTimer = null;

// Shared schedule logic — duplicated in content.js and options.js
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
      : cur >= start || cur < end; // overnight range e.g. 22:00–06:00
  }
  return true;
}

function domainRegex(domain) {
  const escaped = domain.replace(/\./g, '\\.');
  return `^https?://([a-z0-9-]+\\.)*${escaped}([/?#]|$)`;
}

async function getSites() {
  const { blockedSites } = await chrome.storage.sync.get('blockedSites');
  return blockedSites || DEFAULT_SITES;
}

async function setupRules() {
  const sites = await getSites();
  const activeSites = sites.filter(isSiteActiveNow);
  const existing = await chrome.declarativeNetRequest.getDynamicRules();

  const rules = activeSites.map(site => ({
    id: site.id,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { extensionPath: `/blocked.html?site=${encodeURIComponent(site.name)}` }
    },
    condition: {
      regexFilter: domainRegex(site.domain),
      resourceTypes: ['main_frame']
    }
  }));

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map(r => r.id),
    addRules: rules
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('The Focuser — rule setup failed:', chrome.runtime.lastError);
    }
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  const { blockedSites } = await chrome.storage.sync.get('blockedSites');
  if (!blockedSites) {
    await chrome.storage.sync.set({ blockedSites: DEFAULT_SITES, nextId: 6 });
  }
  chrome.alarms.create('scheduleCheck', { periodInMinutes: 1 });
  setupRules();
});

chrome.runtime.onStartup.addListener(async () => {
  const alarm = await chrome.alarms.get('scheduleCheck');
  if (!alarm) chrome.alarms.create('scheduleCheck', { periodInMinutes: 1 });
  setupRules();
});

// Re-evaluate schedules every minute so time-range and duration blocks
// activate/deactivate automatically without needing a page reload.
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'scheduleCheck') setupRules();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'reloadRules') {
    setupRules().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.action === 'countVisit') {
    (async () => {
      const { visitCounts = {} } = await chrome.storage.local.get('visitCounts');
      visitCounts[msg.site] = (visitCounts[msg.site] || 0) + 1;
      await chrome.storage.local.set({ visitCounts });
    })();
    return false;
  }

  if (msg.action === 'pause') {
    chrome.declarativeNetRequest.getDynamicRules().then(existing => {
      chrome.declarativeNetRequest.updateDynamicRules(
        { removeRuleIds: existing.map(r => r.id), addRules: [] },
        () => {
          sendResponse({ ok: true });
          if (pauseTimer) clearTimeout(pauseTimer);
          pauseTimer = setTimeout(() => { setupRules(); pauseTimer = null; },
            msg.minutes * 60 * 1000);
        }
      );
    });
    return true;
  }
});
