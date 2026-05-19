const domainInput = document.getElementById('domain-input');
const nameInput   = document.getElementById('name-input');
const addBtn      = document.getElementById('add-btn');
const errorMsg    = document.getElementById('error-msg');
const siteList    = document.getElementById('site-list');
const countEl     = document.getElementById('count');
const totalEl     = document.getElementById('total-count');
const resetBtn    = document.getElementById('reset-btn');

const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

// Same logic as background.js and content.js
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
    return start <= end ? (cur >= start && cur < end) : (cur >= start || cur < end);
  }
  return true;
}

function scheduleBadge(site) {
  const s = site.schedule;
  if (!s || s.type === 'always') return { text: 'Always', cls: 'sch-always' };

  if (s.type === 'duration') {
    if (!s.until || Date.now() >= s.until) return { text: 'Expired', cls: 'sch-expired' };
    const t = new Date(s.until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return { text: `Until ${t}`, cls: 'sch-duration' };
  }

  if (s.type === 'timerange') {
    const on = isSiteActiveNow(site);
    return {
      text: `${s.startTime} – ${s.endTime}`,
      cls: on ? 'sch-range-on' : 'sch-range-off'
    };
  }

  return { text: 'Always', cls: 'sch-always' };
}

function buildEditorHTML(site) {
  const s   = site.schedule || { type: 'always' };
  const id  = site.id;
  const isAlways    = !s.type || s.type === 'always';
  const isDuration  = s.type === 'duration';
  const isTimerange = s.type === 'timerange';

  let hours = '2';
  if (isDuration && s.until && s.until > Date.now()) {
    hours = ((s.until - Date.now()) / 3600000).toFixed(1);
  }
  const startTime = isTimerange ? s.startTime : '09:00';
  const endTime   = isTimerange ? s.endTime   : '17:00';

  return `
    <div class="editor-inner">
      <label class="sched-opt">
        <input type="radio" class="sched-type" name="sched-${id}" value="always" ${isAlways ? 'checked' : ''}>
        Always blocked
      </label>

      <label class="sched-opt">
        <input type="radio" class="sched-type" name="sched-${id}" value="duration" ${isDuration ? 'checked' : ''}>
        Block for
        <input type="number" class="sched-hours" value="${hours}" min="0.5" max="168" step="0.5">
        hours from now
      </label>

      <label class="sched-opt">
        <input type="radio" class="sched-type" name="sched-${id}" value="timerange" ${isTimerange ? 'checked' : ''}>
        Block from
        <input type="time" class="sched-start" value="${startTime}">
        to
        <input type="time" class="sched-end" value="${endTime}">
      </label>

      <div class="editor-footer">
        <button class="btn-save-sched" data-id="${id}">Save</button>
        <button class="btn-cancel-sched" data-id="${id}">Cancel</button>
      </div>
    </div>`;
}

async function loadData() {
  const [{ blockedSites = [] }, { visitCounts = {} }] = await Promise.all([
    chrome.storage.sync.get('blockedSites'),
    chrome.storage.local.get('visitCounts'),
  ]);
  render(blockedSites, visitCounts);
}

function render(sites, counts) {
  countEl.textContent = sites.length;
  totalEl.textContent = Object.values(counts).reduce((s, n) => s + n, 0);
  siteList.innerHTML  = '';

  if (!sites.length) {
    siteList.innerHTML = '<p class="empty">No sites blocked yet.</p>';
    return;
  }

  for (const site of sites) {
    const n     = counts[site.name] || 0;
    const badge = scheduleBadge(site);

    const item = document.createElement('div');
    item.className = 'site-item';
    item.innerHTML = `
      <div class="site-main">
        <div class="site-info">
          <span class="site-domain">${site.domain}</span>
          ${site.name && site.name !== site.domain ? `<span class="site-label">${site.name}</span>` : ''}
          ${site.isDefault ? '<span class="badge-default">default</span>' : ''}
          <span class="badge-sched ${badge.cls}">${badge.text}</span>
        </div>
        <div class="site-actions">
          ${n > 0 ? `<span class="count-badge">${n} blocked</span>` : ''}
          <button class="btn-schedule" data-id="${site.id}">Schedule</button>
          <button class="btn-remove"   data-id="${site.id}">Remove</button>
        </div>
      </div>
      <div class="schedule-editor" id="editor-${site.id}" hidden>
        ${buildEditorHTML(site)}
      </div>`;

    siteList.appendChild(item);
  }

  siteList.querySelectorAll('.btn-schedule').forEach(b =>
    b.addEventListener('click', () => toggleEditor(Number(b.dataset.id))));

  siteList.querySelectorAll('.btn-save-sched').forEach(b =>
    b.addEventListener('click', () => saveSchedule(Number(b.dataset.id))));

  siteList.querySelectorAll('.btn-cancel-sched').forEach(b =>
    b.addEventListener('click', () => toggleEditor(Number(b.dataset.id))));

  siteList.querySelectorAll('.btn-remove').forEach(b =>
    b.addEventListener('click', () => removeSite(Number(b.dataset.id))));
}

function toggleEditor(id) {
  const editor = document.getElementById(`editor-${id}`);
  const btn    = siteList.querySelector(`.btn-schedule[data-id="${id}"]`);
  if (!editor) return;
  editor.hidden  = !editor.hidden;
  if (btn) btn.textContent = editor.hidden ? 'Schedule' : 'Close';
}

async function saveSchedule(id) {
  const editor = document.getElementById(`editor-${id}`);
  const type   = editor.querySelector(`[name="sched-${id}"]:checked`)?.value || 'always';

  let schedule = { type };

  if (type === 'duration') {
    const hours = parseFloat(editor.querySelector('.sched-hours').value);
    if (!hours || hours <= 0) { return; }
    schedule.until = Date.now() + hours * 3600000;
  } else if (type === 'timerange') {
    schedule.startTime = editor.querySelector('.sched-start').value;
    schedule.endTime   = editor.querySelector('.sched-end').value;
    if (!schedule.startTime || !schedule.endTime) return;
  }

  const { blockedSites = [] } = await chrome.storage.sync.get('blockedSites');
  await chrome.storage.sync.set({
    blockedSites: blockedSites.map(s => s.id === id ? { ...s, schedule } : s)
  });
  await chrome.runtime.sendMessage({ action: 'reloadRules' });
  loadData();
}

function showError(msg) {
  errorMsg.textContent = msg;
  setTimeout(() => { errorMsg.textContent = ''; }, 3000);
}

async function addSite() {
  let raw = domainInput.value.trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];

  if (!raw) { showError('Enter a domain.'); return; }
  if (!DOMAIN_RE.test(raw)) { showError('Invalid domain — use the format: reddit.com'); return; }

  const { blockedSites = [], nextId = 6 } = await chrome.storage.sync.get(['blockedSites', 'nextId']);
  if (blockedSites.some(s => s.domain === raw)) { showError('Already in the blocked list.'); return; }

  const label = nameInput.value.trim() || raw;
  await chrome.storage.sync.set({
    blockedSites: [...blockedSites, { id: nextId, domain: raw, name: label, isDefault: false }],
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
