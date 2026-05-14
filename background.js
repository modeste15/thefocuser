const DEFAULT_SITES = [
  { id: 1, domain: 'facebook.com',  name: 'Facebook',    isDefault: true },
  { id: 2, domain: 'instagram.com', name: 'Instagram',   isDefault: true },
  { id: 3, domain: 'twitter.com',   name: 'Twitter',     isDefault: true },
  { id: 4, domain: 'x.com',         name: 'X (Twitter)', isDefault: true },
  { id: 5, domain: 'tiktok.com',    name: 'TikTok',      isDefault: true },
];

let pauseTimer = null;

async function getSites() {
  const { blockedSites } = await chrome.storage.sync.get('blockedSites');
  return blockedSites || DEFAULT_SITES;
}


function domainRegex(domain) {
  const escaped = domain.replace(/\./g, '\\.');
  return `^https?://([a-z0-9-]+\\.)*${escaped}([/?#]|$)`;
}

async function setupRules() {
  const sites = await getSites();
  const existing = await chrome.declarativeNetRequest.getDynamicRules();

  const rules = sites.map(site => ({
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
      console.error('The Focus — rule setup failed:', chrome.runtime.lastError);
    }
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  const { blockedSites } = await chrome.storage.sync.get('blockedSites');
  if (!blockedSites) {
    await chrome.storage.sync.set({ blockedSites: DEFAULT_SITES, nextId: 6 });
  }
  setupRules();
});

chrome.runtime.onStartup.addListener(setupRules);

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
          pauseTimer = setTimeout(() => {
            setupRules();
            pauseTimer = null;
          }, msg.minutes * 60 * 1000);
        }
      );
    });
    return true;
  }
});
