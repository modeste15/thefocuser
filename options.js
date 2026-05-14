const domainInput = document.getElementById('domain-input');
const nameInput   = document.getElementById('name-input');
const addBtn      = document.getElementById('add-btn');
const errorMsg    = document.getElementById('error-msg');
const siteList    = document.getElementById('site-list');
const countEl     = document.getElementById('count');
const totalEl     = document.getElementById('total-count');
const resetBtn    = document.getElementById('reset-btn');

// RFC-compliant domain label: starts/ends with alnum, hyphens allowed inside
const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

async function loadData() {
  const [{ blockedSites = [] }, { visitCounts = {} }] = await Promise.all([
    chrome.storage.sync.get('blockedSites'),
    chrome.storage.local.get('visitCounts'),
  ]);
  render(blockedSites, visitCounts);
}

function render(sites, counts) {
  countEl.textContent = sites.length;

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  totalEl.textContent = total;

  siteList.innerHTML = '';

  if (sites.length === 0) {
    siteList.innerHTML = '<p class="empty">No sites blocked yet.</p>';
    return;
  }

  for (const site of sites) {
    const n = counts[site.name] || 0;
    const item = document.createElement('div');
    item.className = 'site-item';
    item.innerHTML = `
      <div class="site-info">
        <span class="site-domain">${site.domain}</span>
        ${site.name && site.name !== site.domain
          ? `<span class="site-label">${site.name}</span>` : ''}
        ${site.isDefault ? '<span class="badge-default">default</span>' : ''}
      </div>
      <div class="site-actions">
        ${n > 0 ? `<span class="count-badge">${n} blocked</span>` : ''}
        <button class="btn-remove" data-id="${site.id}">Remove</button>
      </div>
    `;
    siteList.appendChild(item);
  }

  siteList.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', () => removeSite(Number(btn.dataset.id)));
  });
}

function showError(msg) {
  errorMsg.textContent = msg;
  setTimeout(() => { errorMsg.textContent = ''; }, 3000);
}

async function addSite() {
  let raw = domainInput.value.trim().toLowerCase();

  // Strip scheme and path so users can paste full URLs
  raw = raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];

  if (!raw) { showError('Enter a domain.'); return; }
  if (!DOMAIN_RE.test(raw)) {
    showError('Invalid domain — use the format: reddit.com');
    return;
  }

  const { blockedSites = [], nextId = 6 } = await chrome.storage.sync.get(['blockedSites', 'nextId']);

  if (blockedSites.some(s => s.domain === raw)) {
    showError('Already in the blocked list.');
    return;
  }

  const label = nameInput.value.trim() || raw;
  const newSite = { id: nextId, domain: raw, name: label, isDefault: false };

  await chrome.storage.sync.set({
    blockedSites: [...blockedSites, newSite],
    nextId: nextId + 1,
  });

  domainInput.value = '';
  nameInput.value   = '';
  await chrome.runtime.sendMessage({ action: 'reloadRules' });
  loadData();
}

async function removeSite(id) {
  const { blockedSites = [] } = await chrome.storage.sync.get('blockedSites');
  await chrome.storage.sync.set({ blockedSites: blockedSites.filter(s => s.id !== id) });
  await chrome.runtime.sendMessage({ action: 'reloadRules' });
  loadData();
}

async function resetCounts() {
  await chrome.storage.local.set({ visitCounts: {} });
  loadData();
}

addBtn.addEventListener('click', addSite);
domainInput.addEventListener('keydown', e => { if (e.key === 'Enter') addSite(); });
resetBtn.addEventListener('click', resetCounts);

loadData();
