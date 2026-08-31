// Signal Ping — PWA frontend.
//
// Three features, matching the API:
//   Live Alert     -> POST /api/alerts/live            (partner's device buzzes now)
//   Self Timer     -> entirely local; never leaves this device
//   Partner Timer  -> POST /api/alerts/partner-timer   (Worker cron fires it later)

/* ------------------------------------------------------------------ */
/* Local state                                                         */
/* ------------------------------------------------------------------ */

const STORE_KEY = 'signal-ping/state';

const defaultState = {
  apiBase: '', // empty = same origin as this page (the Worker serving it)
  token: null,
  displayName: 'Me',
  labels: { live: 'Free to talk', partnerTimer: 'Ping me when this is up', selfTimer: 'Check in' },
  selfTimer: null, // { label, fireAt } — a unix-seconds deadline, survives reloads
};

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') };
  } catch {
    return { ...defaultState };
  }
}

let state = loadState();

function saveState(patch = {}) {
  state = { ...state, ...patch };
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

const $ = (id) => document.getElementById(id);
const nowSec = () => Math.floor(Date.now() / 1000);

/* ------------------------------------------------------------------ */
/* API client                                                          */
/* ------------------------------------------------------------------ */

function apiUrl(path) {
  const base = (state.apiBase || location.origin).replace(/\/$/, '');
  return base + path;
}

async function api(path, { method = 'GET', body, token = state.token } = {}) {
  const res = await fetch(apiUrl(path), {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ------------------------------------------------------------------ */
/* UI helpers                                                          */
/* ------------------------------------------------------------------ */

let toastTimer;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3200);
}

function showView(name) {
  for (const id of ['view-pair', 'view-app', 'view-settings']) $(id).hidden = id !== `view-${name}`;
  window.scrollTo(0, 0);
}

// "4m 05s" for live countdowns, "in 2h 10m" for scheduled items.
function formatRemaining(seconds) {
  if (seconds <= 0) return 'now';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function formatTime(unixSeconds) {
  const d = new Date(unixSeconds * 1000);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/* ------------------------------------------------------------------ */
/* Pairing                                                             */
/* ------------------------------------------------------------------ */

const CODE_WORDS = [
  'amber', 'harbor', 'quiet', 'ember', 'north', 'linen', 'cobalt', 'meadow',
  'stone', 'violet', 'orbit', 'canyon', 'willow', 'signal', 'tundra', 'ridge',
];

// A memorable code that's still hard to guess: two words plus four digits.
function suggestCode() {
  const pick = () => CODE_WORDS[crypto.getRandomValues(new Uint32Array(1))[0] % CODE_WORDS.length];
  const digits = String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, '0');
  return `${pick()}-${pick()}-${digits}`;
}

async function handlePair() {
  const code = $('pair-code').value.trim();
  const displayName = $('pair-name').value.trim() || 'Me';
  const apiBase = $('pair-api').value.trim();

  if (code.length < 8) return toast('Pairing code needs at least 8 characters');

  saveState({ apiBase });
  $('pair-submit').disabled = true;
  try {
    const result = await api('/api/pair/join', { method: 'POST', body: { code, displayName }, token: null });
    saveState({ token: result.token, displayName });
    toast(result.slot === 1 ? 'Pair created — send the code to your partner' : 'Paired');
    await startApp();
  } catch (err) {
    toast(err.message);
  } finally {
    $('pair-submit').disabled = false;
  }
}

// Second device / reinstall: reuse an existing account's token.
async function handleRestore() {
  const token = $('restore-token').value.trim();
  const apiBase = $('pair-api').value.trim();
  if (!token) return toast('Paste the access token from your other device');

  saveState({ apiBase });
  try {
    const me = await api('/api/me', { token });
    saveState({ token, displayName: me.user.displayName, labels: me.user.labels });
    toast('Device restored');
    await startApp();
  } catch (err) {
    toast(err.message);
  }
}

/* ------------------------------------------------------------------ */
/* Push subscription                                                   */
/* ------------------------------------------------------------------ */

function urlBase64ToUint8Array(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function swRegistration() {
  if (!('serviceWorker' in navigator)) throw new Error('This browser has no service worker support');
  return navigator.serviceWorker.ready;
}

// Asks for permission (must be called from a tap on iOS), subscribes, and
// registers the subscription with the Worker.
async function enablePush() {
  if (!('Notification' in window)) return toast('This browser cannot show notifications');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return toast('Notification permission was not granted');

  const reg = await swRegistration();
  const { key } = await api('/api/push/vapid-public-key', { token: null });
  if (!key) throw new Error('Server has no VAPID public key configured');

  const existing = await reg.pushManager.getSubscription();
  const subscription =
    existing ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    }));

  await api('/api/push/subscribe', { method: 'POST', body: subscription.toJSON() });
  toast('Notifications enabled on this device');
  await refreshMe();
}

async function disablePush() {
  const reg = await swRegistration();
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return toast('This device is not subscribed');

  await api('/api/push/unsubscribe', { method: 'POST', body: { endpoint: subscription.endpoint } });
  await subscription.unsubscribe();
  toast('Notifications stopped on this device');
  await refreshMe();
}

// Re-registers the current subscription on every launch. Push endpoints rotate,
// and a stale endpoint is a silently undelivered alert.
async function refreshSubscription() {
  if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return;
  try {
    const reg = await swRegistration();
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) await api('/api/push/subscribe', { method: 'POST', body: subscription.toJSON() });
  } catch (err) {
    console.warn('subscription refresh failed', err);
  }
}

async function renderPushState(me) {
  const supported = 'Notification' in window && 'serviceWorker' in window.navigator;
  const permission = supported ? Notification.permission : 'unsupported';
  const subscribed = me?.devices?.length || 0;

  $('push-state').textContent = !supported
    ? 'This browser does not support web push. Install the app to the home screen and try again.'
    : permission === 'granted'
      ? `Permission granted. ${subscribed} device${subscribed === 1 ? '' : 's'} registered on this account.`
      : permission === 'denied'
        ? 'Notifications are blocked. Re-allow them in your browser or OS settings for this app.'
        : 'Notifications are not enabled yet on this device.';

  const list = $('device-list');
  list.innerHTML = '';
  for (const device of me?.devices || []) {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = describeUserAgent(device.userAgent);
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `seen ${formatTime(device.lastSeenAt)}`;
    li.append(name, meta);
    list.append(li);
  }
}

// Just enough parsing to tell two phones apart in the device list.
function describeUserAgent(ua = '') {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone / iPad';
  if (/Android/i.test(ua)) return 'Android device';
  if (/Macintosh/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  return 'Device';
}

/* ------------------------------------------------------------------ */
/* Feature 1 — Live Alert                                              */
/* ------------------------------------------------------------------ */

async function sendLiveAlert() {
  const button = $('live-alert');
  button.disabled = true;
  try {
    const result = await api('/api/alerts/live', { method: 'POST', body: { label: state.labels.live } });
    toast(
      result.devices === 0
        ? 'Sent, but your partner has no device registered yet'
        : `Sent to ${result.delivered} of ${result.devices} device${result.devices === 1 ? '' : 's'}`,
    );
    if (navigator.vibrate) navigator.vibrate(30);
    await refreshLog();
  } catch (err) {
    toast(err.message);
  } finally {
    button.disabled = false;
  }
}

/* ------------------------------------------------------------------ */
/* Feature 2 — Self Timer (local device only)                          */
/* ------------------------------------------------------------------ */

let selfTimeout;

function startSelfTimer(minutes, label) {
  if (!Number.isFinite(minutes) || minutes < 1) return toast('Enter a number of minutes');
  saveState({ selfTimer: { label: label || state.labels.selfTimer, fireAt: nowSec() + Math.round(minutes * 60) } });
  scheduleSelfTimer();
  renderSelfTimer();
  toast(`Self timer set for ${formatRemaining(Math.round(minutes * 60))}`);
}

function cancelSelfTimer() {
  clearTimeout(selfTimeout);
  saveState({ selfTimer: null });
  renderSelfTimer();
  toast('Self timer cancelled');
}

// setTimeout is the primary trigger while the page is alive; the deadline is
// also persisted, so a timer that elapsed while the app was closed still fires
// (late, and clearly marked) the next time the app is opened.
function scheduleSelfTimer() {
  clearTimeout(selfTimeout);
  if (!state.selfTimer) return;
  const msLeft = (state.selfTimer.fireAt - nowSec()) * 1000;
  if (msLeft <= 0) return fireSelfTimer();
  // setTimeout tops out around 24.8 days; self timers are capped well below that.
  selfTimeout = setTimeout(fireSelfTimer, msLeft);
}

async function fireSelfTimer() {
  const timer = state.selfTimer;
  if (!timer) return;

  const late = nowSec() - timer.fireAt > 60;
  saveState({ selfTimer: null });
  renderSelfTimer();

  const body = late ? `Was due ${formatTime(timer.fireAt)}` : 'Self timer finished';
  try {
    // Notify through the service worker so the notification behaves the same
    // whether the app is focused or in the background.
    const reg = await swRegistration();
    await reg.showNotification(timer.label, {
      body,
      tag: 'signal-ping-self',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      vibrate: [120, 60, 120],
      requireInteraction: true,
      data: { kind: 'self_timer' },
    });
  } catch {
    toast(`${timer.label} — ${body}`);
  }
  if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
}

function renderSelfTimer() {
  const wrap = $('self-active');
  if (!state.selfTimer) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  $('self-active-label').textContent = state.selfTimer.label;
  $('self-active-countdown').textContent = `fires in ${formatRemaining(state.selfTimer.fireAt - nowSec())}`;
}

/* ------------------------------------------------------------------ */
/* Feature 3 — Partner Timer                                           */
/* ------------------------------------------------------------------ */

let pendingPartnerAlerts = [];

async function schedulePartnerAlert(minutes, label) {
  if (!Number.isFinite(minutes) || minutes < 1) return toast('Enter a number of minutes');
  try {
    await api('/api/alerts/partner-timer', {
      method: 'POST',
      body: { seconds: Math.round(minutes * 60), label: label || state.labels.partnerTimer },
    });
    toast(`Partner alert scheduled in ${formatRemaining(Math.round(minutes * 60))}`);
    await refreshPartnerAlerts();
  } catch (err) {
    toast(err.message);
  }
}

async function cancelPartnerAlert(id) {
  try {
    await api(`/api/alerts/partner-timer/${id}/cancel`, { method: 'POST' });
    toast('Partner alert cancelled');
    await refreshPartnerAlerts();
  } catch (err) {
    toast(err.message);
  }
}

// Editing is "how many minutes from now, instead" — the same question the
// scheduling form asks, so there is only one mental model.
async function editPartnerAlert(alert) {
  const answer = prompt('Fire this alert in how many minutes from now?', '15');
  if (answer === null) return;
  const minutes = Number(answer);
  if (!Number.isFinite(minutes) || minutes < 1) return toast('Enter a number of minutes');
  try {
    await api(`/api/alerts/partner-timer/${alert.id}`, {
      method: 'PATCH',
      body: { seconds: Math.round(minutes * 60) },
    });
    toast('Partner alert rescheduled');
    await refreshPartnerAlerts();
  } catch (err) {
    toast(err.message);
  }
}

async function refreshPartnerAlerts() {
  try {
    const { alerts } = await api('/api/alerts/partner-timer');
    pendingPartnerAlerts = alerts;
    renderPartnerAlerts();
  } catch (err) {
    console.warn('could not load partner alerts', err);
  }
}

function renderPartnerAlerts() {
  const list = $('partner-pending');
  list.innerHTML = '';

  for (const alert of pendingPartnerAlerts) {
    const li = document.createElement('li');

    const text = document.createElement('div');
    const label = document.createElement('strong');
    label.textContent = alert.label;
    const countdown = document.createElement('span');
    countdown.className = 'countdown';
    countdown.textContent = `fires in ${formatRemaining(alert.fireAt - nowSec())} · ${formatTime(alert.fireAt)}`;
    text.append(label, countdown);

    const edit = document.createElement('button');
    edit.className = 'btn-secondary';
    edit.textContent = 'Edit';
    edit.onclick = () => editPartnerAlert(alert);

    const cancel = document.createElement('button');
    cancel.className = 'btn-secondary';
    cancel.textContent = 'Cancel';
    cancel.onclick = () => cancelPartnerAlert(alert.id);

    const actions = document.createElement('div');
    actions.className = 'row';
    actions.append(edit, cancel);

    li.append(text, actions);
    list.append(li);
  }
}

/* ------------------------------------------------------------------ */
/* Alert log                                                           */
/* ------------------------------------------------------------------ */

async function refreshLog() {
  const list = $('alert-log');
  try {
    const { entries } = await api('/api/alerts/log?limit=30');
    list.innerHTML = '';

    if (!entries.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No alerts yet.';
      list.append(li);
      return;
    }

    for (const entry of entries) {
      const li = document.createElement('li');
      const text = document.createElement('span');
      const arrow = entry.direction === 'sent' ? '→' : '←';
      const kind = entry.kind === 'live' ? 'Live' : 'Timer';
      text.textContent = `${arrow} ${entry.label} · ${kind}`;
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = formatTime(entry.createdAt);
      li.append(text, meta);
      list.append(li);
    }
  } catch (err) {
    console.warn('could not load alert log', err);
  }
}

/* ------------------------------------------------------------------ */
/* Account / settings                                                  */
/* ------------------------------------------------------------------ */

let me = null;

async function refreshMe() {
  me = await api('/api/me');
  saveState({ displayName: me.user.displayName, labels: me.user.labels });

  $('live-label').textContent = me.user.labels.live;
  $('partner-name').textContent = me.partner.paired ? me.partner.displayName : 'your partner';
  $('self-label').placeholder = me.user.labels.selfTimer;
  $('partner-label').placeholder = me.user.labels.partnerTimer;

  $('status-line').textContent = me.partner.paired
    ? `Paired with ${me.partner.displayName}.`
    : 'Waiting for your partner to join with the same pairing code.';

  $('set-name').value = me.user.displayName;
  $('set-live').value = me.user.labels.live;
  $('set-partner').value = me.user.labels.partnerTimer;
  $('set-self').value = me.user.labels.selfTimer;
  $('show-token').value = state.token || '';
  $('set-api').value = state.apiBase;
  $('pair-state').textContent = me.partner.paired
    ? `Paired with ${me.partner.displayName}. This pair is full.`
    : 'Not paired yet — share your pairing code with the other person.';

  await renderPushState(me);
  return me;
}

async function saveSettings() {
  try {
    const result = await api('/api/settings', {
      method: 'PATCH',
      body: {
        displayName: $('set-name').value.trim() || undefined,
        liveLabel: $('set-live').value.trim() || undefined,
        partnerTimerLabel: $('set-partner').value.trim() || undefined,
        selfTimerLabel: $('set-self').value.trim() || undefined,
      },
    });
    saveState({ displayName: result.displayName, labels: result.labels });
    await refreshMe();
    toast('Saved');
  } catch (err) {
    toast(err.message);
  }
}

function signOut() {
  if (!confirm('Sign out of this device? You will need your access token or pairing code to get back in.')) return;
  localStorage.removeItem(STORE_KEY);
  state = loadState();
  location.reload();
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

function bindPresetRow(container, minutesInput) {
  container.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip');
    if (!chip) return;
    minutesInput.value = chip.dataset.minutes;
    for (const c of container.querySelectorAll('.chip')) c.setAttribute('aria-pressed', String(c === chip));
  });
}

function bindEvents() {
  // Pairing
  $('pair-submit').onclick = handlePair;
  $('restore-submit').onclick = handleRestore;
  $('pair-suggest').onclick = () => ($('pair-code').value = suggestCode());

  // Navigation
  $('open-settings').onclick = () => showView('settings');
  $('close-settings').onclick = () => showView('app');

  // Live Alert
  $('live-alert').onclick = sendLiveAlert;

  // Self Timer
  bindPresetRow(document.querySelector('.preset-row[data-target="self"]'), $('self-minutes'));
  $('self-start').onclick = () => startSelfTimer(Number($('self-minutes').value), $('self-label').value.trim());
  $('self-cancel').onclick = cancelSelfTimer;

  // Partner Timer
  bindPresetRow(document.querySelector('.preset-row[data-target="partner"]'), $('partner-minutes'));
  $('partner-start').onclick = () =>
    schedulePartnerAlert(Number($('partner-minutes').value), $('partner-label').value.trim());

  // Log
  $('refresh-log').onclick = refreshLog;

  // Settings
  $('enable-push').onclick = () => enablePush().catch((err) => toast(err.message));
  $('disable-push').onclick = () => disablePush().catch((err) => toast(err.message));
  $('test-push').onclick = async () => {
    try {
      const { delivered, failed } = await api('/api/push/test', { method: 'POST' });
      toast(`Test sent — ${delivered} delivered, ${failed} failed`);
    } catch (err) {
      toast(err.message);
    }
  };
  $('save-settings').onclick = saveSettings;
  $('reveal-token').onclick = () => {
    const field = $('show-token');
    field.type = field.type === 'password' ? 'text' : 'password';
    $('reveal-token').textContent = field.type === 'password' ? 'Show' : 'Hide';
  };
  $('copy-token').onclick = async () => {
    try {
      await navigator.clipboard.writeText(state.token || '');
      toast('Token copied');
    } catch {
      toast('Copy failed — reveal the token and copy it by hand');
    }
  };
  $('save-api').onclick = () => {
    saveState({ apiBase: $('set-api').value.trim() });
    toast('Server URL saved');
    refreshMe().catch((err) => toast(err.message));
  };
  $('sign-out').onclick = signOut;

  // Coming back to the app is the moment stale state shows: an elapsed self
  // timer, a fired partner alert, a rotated push endpoint.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !state.token) return;
    scheduleSelfTimer();
    refreshPartnerAlerts();
    refreshLog();
  });

  // The service worker tells us when a push arrived while the app was open.
  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type === 'alert-received') {
      toast(`${event.data.from}: ${event.data.label}`);
      refreshLog();
    }
  });
}

// One second tick keeps every countdown on screen honest.
function startTicker() {
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    renderSelfTimer();
    renderPartnerAlerts();
  }, 1000);
}

async function startApp() {
  showView('app');
  $('live-label').textContent = state.labels.live;

  scheduleSelfTimer();
  renderSelfTimer();

  try {
    await refreshMe();
  } catch (err) {
    // A rejected token means this device was signed out server-side.
    if (/token/i.test(err.message)) {
      toast('This device is no longer paired — pair again');
      saveState({ token: null });
      return showView('pair');
    }
    $('status-line').textContent = `Offline — showing the last known state. (${err.message})`;
  }

  await refreshSubscription();
  await Promise.all([refreshPartnerAlerts(), refreshLog()]);
}

async function main() {
  bindEvents();
  startTicker();

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (err) {
      console.warn('service worker registration failed', err);
    }
  }

  if (state.token) {
    await startApp();
  } else {
    $('pair-api').value = state.apiBase;
    $('pair-code').value = suggestCode();
    showView('pair');
  }
}

main();
